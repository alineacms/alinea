import type {Config} from '#/core/Config.js'
import {
  Graph,
  type AnyQueryResult,
  type GraphQuery,
  type Projection,
  type InferProjection
} from '#/core/Graph.js'
import {Field} from '#/core/Field.js'
import type {LinkResolver} from '#/core/db/LinkResolver.js'
import {isRecord} from '#/core/util/Objects.js'
import {and, count, type Database, eq, inArray, table} from 'rado'
import * as column from 'rado/universal/columns'
import {
  EntryDataTable,
  EntryIndexTable,
  entryIndexRow,
  sourceFields,
  type EntrySource,
  type IndexedEntry
} from '../entry/Schema.js'
import {compileEntryQuery} from '../query/EntryQuery.js'
import {createSearch, rebuildSearch, type SearchQuery} from '../query/Search.js'
import type {RelationSource} from '../query/Relation.js'
import {IndexTree} from '../sync/IndexTree.js'

const superseded = Symbol('superseded query')

const Meta = table('alinea_database_state', {
  id: column.integer().primaryKey(),
  revision: column.text().notNull()
})

export interface PayloadRequest {
  versionId: string
  payloadId: string
}

export interface LoadedPayload extends PayloadRequest {
  data: Record<string, unknown>
  source?: EntrySource
}

export interface SerializedPayload extends PayloadRequest {
  dataJson: string
  sourceJson?: string
}

export type PayloadResult = LoadedPayload | SerializedPayload

export interface EntryReplacement {
  entry: IndexedEntry
  /** Omitted for an explore-only entry. */
  payloadId?: string
  data?: Record<string, unknown>
  source?: EntrySource
}

export interface EntryDelta {
  fromRevision: string
  toRevision: string
  entries: ReadonlyArray<EntryReplacement>
  removedVersionIds?: ReadonlyArray<string>
}

export interface RuntimeOptions {
  /** Prepare a complete search plan under the connection's statement queue. */
  search?(input: GraphQuery['search']): Promise<SearchQuery | undefined>
  includedAtBuild?(filePath: string): boolean | Promise<boolean>
  /** The immutable checkpoint already contains its complete FTS5 corpus. */
  searchReady?: boolean
  load?(
    requests: ReadonlyArray<PayloadRequest>
  ): Promise<ReadonlyArray<PayloadResult>>
}

export interface QueryObserver {
  next(value: unknown): void
  error(error: unknown): void
}

/** Owns one local database connection. All access uses its statement queue. */
export class EntryRuntime extends Graph {
  #db: Database
  #config: Config
  #options: RuntimeOptions
  #queue: Promise<unknown> = Promise.resolve()
  #generation = 0
  #searchDirty = true
  #indexTree?: Promise<IndexTree>
  #listeners = new Set<() => void>()

  constructor(config: Config, db: Database, options: RuntimeOptions = {}) {
    super()
    this.#config = config
    this.#db = db
    this.#options = options
    this.#searchDirty = !options.searchReady
  }

  get config(): Config {
    return this.#config
  }

  getRevision(): Promise<string> {
    return this.#exclusive(async () => {
      const revision = await this.#db
        .select(Meta.revision)
        .from(Meta)
        .where(eq(Meta.id, 1))
        .get()
      if (revision == null) throw new Error('Missing database revision')
      return revision
    })
  }

  /** Retry a read-only compound operation if any local commit overlaps it. */
  async readConsistent<T>(read: () => Promise<T>): Promise<T> {
    for (;;) {
      const generation = this.#generation
      try {
        const value = await read()
        if (generation === this.#generation) return value
      } catch (error) {
        if (generation === this.#generation) throw error
      }
    }
  }

  /** Trusted index export: no payload hydration or source-tree materialization. */
  indexSnapshot(): Promise<{
    revision: string
    entries: Array<EntryReplacement>
  }> {
    return this.#exclusive(async () => {
      const revision = await this.#db
        .select(Meta.revision)
        .from(Meta)
        .where(eq(Meta.id, 1))
        .get()
      if (revision == null) throw new Error('Missing database revision')
      const rows = await this.#db.select().from(EntryIndexTable)
      return {
        revision,
        entries: rows.map(row => {
          const {versionId: _, payloadId, ...entry} = row
          return {entry, payloadId: payloadId ?? undefined}
        })
      }
    })
  }

  indexTree(): Promise<IndexTree> {
    if (!this.#indexTree) {
      const pending = this.indexSnapshot()
        .then(snapshot => IndexTree.from(snapshot.entries))
        .catch(error => {
          if (this.#indexTree === pending) this.#indexTree = undefined
          throw error
        })
      this.#indexTree = pending
    }
    return this.#indexTree
  }

  static async createSchema(db: Database, revision: string): Promise<void> {
    await db.create(EntryIndexTable, EntryDataTable, Meta)
    await createSearch(db)
    await db.insert(Meta).values({id: 1, revision})
  }

  /** Read exact resident payloads for a trusted, separately authorized handler. */
  payloads(
    requests: ReadonlyArray<PayloadRequest>
  ): Promise<Array<LoadedPayload>> {
    if (requests.length > 20_000) throw new Error('Too many payload requests')
    const captured = requests.map(request => ({...request}))
    if (
      captured.some(request => !request.versionId || !request.payloadId) ||
      new Set(captured.map(request => request.versionId)).size !==
        captured.length
    )
      throw new Error('Invalid payload requests')
    return this.#exclusive(async () => {
      if (!captured.length) return []
      const rows = await this.#db
        .select({
          versionId: EntryDataTable.versionId,
          payloadId: EntryDataTable.payloadId,
          data: EntryDataTable.data,
          source: EntryDataTable.source
        })
        .from(EntryDataTable)
        .innerJoin(
          EntryIndexTable,
          and(
            eq(EntryDataTable.versionId, EntryIndexTable.versionId),
            eq(EntryDataTable.payloadId, EntryIndexTable.payloadId)
          )
        )
        .where(
          inArray(
            EntryDataTable.versionId,
            captured.map(request => request.versionId)
          )
        )
      const found = new Map(rows.map(row => [row.versionId, row]))
      return captured.map(request => {
        const row = found.get(request.versionId)
        if (!row || row.payloadId !== request.payloadId || !isRecord(row.data))
          throw new Error('Entry payload is unavailable or stale')
        return {
          ...request,
          data: structuredClone(row.data),
          source: validateSource(row.source ?? undefined)
        }
      })
    })
  }

  /** Read the resident SQLite JSON representation without parsing it in JS. */
  serializedPayloads(
    requests: ReadonlyArray<PayloadRequest>
  ): Promise<Array<SerializedPayload>> {
    if (requests.length > 20_000) throw new Error('Too many payload requests')
    const captured = requests.map(request => ({...request}))
    if (!captured.length) return Promise.resolve([])
    return this.#exclusive(async () => {
      const placeholders = captured.map(() => '?').join(',')
      const statement = this.#db.driver.prepare(
        `select d.versionId, d.payloadId, d.data as dataJson,
          d.source as sourceJson
        from alinea_entry_data d
        inner join alinea_entry_index i
          on i.versionId = d.versionId and i.payloadId = d.payloadId
        where d.versionId in (${placeholders})`
      )
      try {
        const rows = await statement.all(
          captured.map(request => request.versionId)
        )
        const found = new Map<
          string,
          {payloadId: string; dataJson: string; sourceJson?: string}
        >(
          rows.map(row => {
            if (
              !isRecord(row) ||
              typeof row.versionId !== 'string' ||
              typeof row.payloadId !== 'string' ||
              typeof row.dataJson !== 'string' ||
              (row.sourceJson !== null &&
                row.sourceJson !== undefined &&
                typeof row.sourceJson !== 'string')
            )
              throw new Error('Invalid serialized payload row')
            return [
              row.versionId,
              {
                payloadId: row.payloadId,
                dataJson: row.dataJson,
                sourceJson: row.sourceJson ?? undefined
              }
            ] as const
          })
        )
        return captured.map(request => {
          const row = found.get(request.versionId)
          if (!row || row.payloadId !== request.payloadId)
            throw new Error('Entry payload is unavailable or stale')
          return {
            ...request,
            dataJson: row.dataJson,
            sourceJson: row.sourceJson ?? undefined
          }
        })
      } finally {
        statement.free()
      }
    })
  }

  #exclusive<T>(run: () => Promise<T>): Promise<T> {
    const task = this.#queue.then(run)
    this.#queue = task.catch(() => {})
    return task
  }

  async apply(delta: EntryDelta): Promise<void> {
    await this.#exclusive(async () => {
      await this.#db.transaction(
        async tx => {
          const state = await tx.select().from(Meta).where(eq(Meta.id, 1)).get()
          if (state?.revision !== delta.fromRevision)
            throw new Error('Database revision mismatch')
          if (delta.toRevision === delta.fromRevision)
            throw new Error('A delta must advance the revision')
          if (
            delta.fromRevision === '' &&
            !delta.removedVersionIds?.length &&
            (await tx.select(count()).from(EntryIndexTable).get()) === 0
          ) {
            const changed = new Set<string>()
            const indexRows = []
            const payloadRows = []
            for (const replacement of delta.entries) {
              const row = entryIndexRow(
                replacement.entry,
                replacement.payloadId
              )
              if (changed.has(row.versionId))
                throw new Error('Duplicate entry in delta')
              changed.add(row.versionId)
              if (replacement.data && !replacement.payloadId)
                throw new Error('Entry data requires a payload identity')
              if (replacement.source !== undefined && !replacement.data)
                throw new Error('Source metadata must accompany entry data')
              indexRows.push(row)
              if (replacement.payloadId && replacement.data)
                payloadRows.push({
                  versionId: row.versionId,
                  payloadId: replacement.payloadId,
                  data: replacement.data,
                  source: validateSource(replacement.source)
                })
            }
            for (let offset = 0; offset < indexRows.length; offset += 1000)
              await tx
                .insert(EntryIndexTable)
                .values(indexRows.slice(offset, offset + 1000))
            for (let offset = 0; offset < payloadRows.length; offset += 1000)
              await tx
                .insert(EntryDataTable)
                .values(payloadRows.slice(offset, offset + 1000))
            await tx
              .update(Meta)
              .set({revision: delta.toRevision})
              .where(eq(Meta.id, 1))
            return
          }
          const changed = new Set(delta.removedVersionIds)
          for (const replacement of delta.entries) {
            const row = entryIndexRow(replacement.entry, replacement.payloadId)
            if (changed.has(row.versionId))
              throw new Error('Duplicate entry in delta')
            changed.add(row.versionId)
            if (replacement.data && !replacement.payloadId)
              throw new Error('Entry data requires a payload identity')
            if (replacement.source !== undefined && !replacement.data)
              throw new Error('Source metadata must accompany entry data')
            const existing = await tx
              .select(EntryIndexTable.payloadId)
              .from(EntryIndexTable)
              .where(eq(EntryIndexTable.versionId, row.versionId))
              .get()
            if (
              existing !== (replacement.payloadId ?? null) ||
              replacement.data ||
              !replacement.payloadId
            )
              await tx
                .delete(EntryDataTable)
                .where(eq(EntryDataTable.versionId, row.versionId))
            await tx
              .delete(EntryIndexTable)
              .where(eq(EntryIndexTable.versionId, row.versionId))
            await tx.insert(EntryIndexTable).values(row)
            if (replacement.payloadId && replacement.data)
              await tx.insert(EntryDataTable).values({
                versionId: row.versionId,
                payloadId: replacement.payloadId,
                data: replacement.data,
                source: validateSource(replacement.source)
              })
          }
          for (const id of delta.removedVersionIds ?? []) {
            await tx
              .delete(EntryIndexTable)
              .where(eq(EntryIndexTable.versionId, id))
            await tx
              .delete(EntryDataTable)
              .where(eq(EntryDataTable.versionId, id))
          }
          await tx
            .update(Meta)
            .set({revision: delta.toRevision})
            .where(eq(Meta.id, 1))
        },
        {async: true}
      )
      this.#generation++
      this.#searchDirty = true
      this.#indexTree = undefined
    })
    for (const invalidate of this.#listeners) invalidate()
  }

  async #missing(ids: ReadonlyArray<string>): Promise<Array<PayloadRequest>> {
    const missing: Array<PayloadRequest> = []
    for (let offset = 0; offset < ids.length; offset += 1000) {
      const batch = ids.slice(offset, offset + 1000)
      const manifests = await this.#db
        .select({
          versionId: EntryIndexTable.versionId,
          payloadId: EntryIndexTable.payloadId
        })
        .from(EntryIndexTable)
        .where(inArray(EntryIndexTable.versionId, batch))
      if (
        manifests.length !== batch.length ||
        manifests.some(row => row.payloadId === null)
      )
        throw new Error('Entry payload is not readable')
      const resident = new Map(
        (
          await this.#db
            .select({
              id: EntryDataTable.versionId,
              payload: EntryDataTable.payloadId
            })
            .from(EntryDataTable)
            .where(inArray(EntryDataTable.versionId, batch))
        ).map(row => [row.id, row.payload])
      )
      missing.push(
        ...manifests
          .filter(row => resident.get(row.versionId) !== row.payloadId)
          .map(row => ({versionId: row.versionId, payloadId: row.payloadId!}))
      )
    }
    return missing
  }

  async #hydrate(
    ids: ReadonlyArray<string>,
    generation: number
  ): Promise<void> {
    const requests = await this.#exclusive(async () =>
      this.#generation === generation ? this.#missing([...new Set(ids)]) : []
    )
    if (!requests.length) return
    if (!this.#options.load)
      throw new Error('Entry payloads are missing and no loader is configured')
    // No database transaction is held during transport.
    const loaded: Array<PayloadResult> = []
    try {
      for (let offset = 0; offset < requests.length; offset += 20_000) {
        loaded.push(
          ...(await this.#options.load(requests.slice(offset, offset + 20_000)))
        )
        if (this.#generation !== generation) return
      }
    } catch (error) {
      // A superseded request may fail because its grant or payload was revoked.
      // Retry against the current manifest instead of surfacing the stale error.
      if (this.#generation !== generation) return
      throw error
    }
    const returned = new Map(
      loaded.map(payload => [payload.versionId, payload])
    )
    if (loaded.length !== requests.length || returned.size !== requests.length)
      throw new Error('Unexpected or duplicate payload response')
    for (const request of requests) {
      const payload = returned.get(request.versionId)
      if (
        payload?.payloadId !== request.payloadId ||
        ('data' in payload
          ? !isRecord(payload.data)
          : typeof payload.dataJson !== 'string')
      )
        throw new Error(`Incomplete payload response for ${request.versionId}`)
      if ('source' in payload) validateSource(payload.source)
    }
    await this.#exclusive(async () => {
      if (this.#generation !== generation) return
      const rows = requests.map(request => {
        const payload = returned.get(request.versionId)!
        return {
          versionId: request.versionId,
          payloadId: request.payloadId,
          dataJson:
            'dataJson' in payload
              ? payload.dataJson
              : JSON.stringify(payload.data),
          sourceJson:
            'dataJson' in payload
              ? payload.sourceJson
              : payload.source === undefined
                ? undefined
                : JSON.stringify(validateSource(payload.source))
        }
      })
      await this.#db.transaction(
        async tx => {
          for (let offset = 0; offset < rows.length; offset += 1000) {
            const batch = rows.slice(offset, offset + 1000)
            await tx.delete(EntryDataTable).where(
              inArray(
                EntryDataTable.versionId,
                batch.map(row => row.versionId)
              )
            )
            // The authenticated server already read these exact values from
            // SQLite. Keep them as text; JSON is parsed only by a query (or a
            // generated column) that actually needs values from the payload.
            const values = batch.map(() => `(?, ?, ?, ?)`).join(',')
            const statement = tx.driver.prepare(
              `insert into alinea_entry_data
                (versionId, payloadId, data, source) values ${values}`
            )
            try {
              await statement.run(
                batch.flatMap(row => [
                  row.versionId,
                  row.payloadId,
                  row.dataJson,
                  row.sourceJson ?? null
                ])
              )
            } finally {
              statement.free()
            }
          }
        },
        {async: true}
      )
      this.#searchDirty = true
    })
  }

  async resolve<const Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    for (;;) {
      try {
        return (await this.#resolve(
          query,
          this.#generation
        )) as AnyQueryResult<Query>
      } catch (error) {
        if (error !== superseded) throw error
      }
    }
  }

  async #resolve(
    query: GraphQuery,
    generation: number,
    source?: RelationSource
  ): Promise<unknown> {
    if (this.#generation !== generation) throw superseded
    const link =
      'edge' in query &&
      (query.edge === 'entrySingle' || query.edge === 'entryMultiple')
    if (link && source) {
      await this.#hydrate([source.versionId], generation)
      if (this.#generation !== generation) throw superseded
      query = {preferredLocale: source.locale ?? undefined, ...query}
    }
    const search = this.#options.search
      ? await this.#exclusive(() => this.#options.search!(query.search))
      : undefined
    const plan = compileEntryQuery(this.#config, query, source, search)
    if (plan.membershipData) {
      const candidates = await this.#exclusive(async () =>
        plan.candidates.all(this.#db)
      )
      await this.#hydrate(candidates, generation)
    }
    if (query.search !== undefined && !this.#options.search)
      await this.#ensureSearch()
    if (this.#generation !== generation) throw superseded
    if (plan.projectionData) {
      const selected = await this.#exclusive(async () =>
        plan.identities.all(this.#db)
      )
      await this.#hydrate(selected as Array<string>, generation)
    }
    const result = await this.#exclusive(async () => {
      if (this.#generation !== generation) throw superseded
      if (plan.count) {
        const total = await this.#db
          .select(count())
          .from(plan.identities.as('matches'))
          .get()
        return {count: total, rows: []}
      }
      const rows = await (
        plan.fields.length || plan.relations.length
          ? plan.contextRows
          : plan.rows
      ).all(this.#db)
      if (!source && query.get && !rows.length)
        throw new Error('Entry not found')
      return {count: undefined, rows}
    })
    if (plan.count) return result.count
    const rows: Array<unknown> = []
    for (const row of result.rows) {
      if (!plan.relations.length && !plan.fields.length) {
        rows.push(row)
        continue
      }
      const projected = row as {value: unknown; source: RelationSource}
      let value = projected.value
      const runtime = this
      const loader: LinkResolver = {
        resolver: {config: this.#config},
        locale: projected.source.locale,
        includedAtBuild(filePath) {
          return runtime.#options.includedAtBuild?.(filePath) ?? false
        },
        async resolveLinks<P extends Projection>(
          projection: P,
          ids: ReadonlyArray<string>
        ): Promise<Array<InferProjection<P>>> {
          return (await runtime.#resolve(
            {
              select: projection,
              id: {in: ids},
              status: query.status ?? 'published',
              preferredLocale: projected.source.locale ?? undefined
            },
            generation
          )) as Array<InferProjection<P>>
        }
      }
      for (const selected of plan.fields) {
        if (!selected.path.length)
          value = await Field.queryValue(selected.field, value, loader)
        else {
          let target = value
          for (const key of selected.path.slice(0, -1)) {
            if (!isRecord(target))
              throw new Error('Invalid field projection path')
            target = target[key]
          }
          if (!isRecord(target))
            throw new Error('Invalid field projection target')
          const key = selected.path.at(-1)!
          const processed = await Field.queryValue(
            selected.field,
            target[key],
            loader
          )
          Object.defineProperty(target, key, {
            value: processed,
            enumerable: true,
            configurable: true,
            writable: true
          })
        }
      }
      for (const relation of plan.relations) {
        const related = await this.#resolve(
          {
            ...relation.query,
            status: query.status ?? 'published'
          },
          generation,
          projected.source
        )
        if (!relation.path.length) value = related
        else {
          let target = value
          for (const key of relation.path.slice(0, -1)) {
            if (!isRecord(target))
              throw new Error('Invalid relation projection path')
            target = target[key]
          }
          if (!isRecord(target))
            throw new Error('Invalid relation projection target')
          Object.defineProperty(target, relation.path.at(-1)!, {
            value: related,
            enumerable: true,
            configurable: true,
            writable: true
          })
        }
      }
      rows.push(value)
    }
    if (this.#generation !== generation) throw superseded
    // Graph's nested projection stage returns undefined for an absent single
    // relation; only the public top-level first/get stage normalizes absence.
    return plan.single ? (source ? rows[0] : (rows[0] ?? null)) : rows
  }

  async #ensureSearch(): Promise<void> {
    if (!this.#searchDirty) return
    await this.#exclusive(async () => {
      if (!this.#searchDirty) return
      await this.#db.transaction(async tx => rebuildSearch(tx), {async: true})
      this.#searchDirty = false
    })
  }

  /** Conservative commit invalidation includes rows outside the current result. */
  subscribe(query: GraphQuery, observer: QueryObserver): () => void {
    let active = true
    let sequence = 0
    const invalidate = () => {
      const current = ++sequence
      this.resolve(query).then(
        value => {
          if (active && current === sequence) observer.next(value)
        },
        error => {
          if (active && current === sequence) observer.error(error)
        }
      )
    }
    this.#listeners.add(invalidate)
    invalidate()
    return () => {
      active = false
      sequence++
      this.#listeners.delete(invalidate)
    }
  }
}

export function validateSource(value: unknown): EntrySource | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value)) throw new Error('Invalid entry source metadata')
  const result: EntrySource = {}
  for (const name of sourceFields) {
    const field = value[name]
    if (field === undefined) continue
    if (typeof field !== 'string')
      throw new Error(`Invalid entry source field: ${name}`)
    result[name] = field
  }
  return result
}
