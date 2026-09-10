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
import {createSearch, type SearchQuery} from '../query/Search.js'
import type {RelationSource} from '../query/Relation.js'

const superseded = Symbol('superseded query')

const Meta = table('alinea_replica_state', {
  id: column.integer().primaryKey(),
  revision: column.text().notNull()
})

const Payload = table('alinea_entry_payload', {
  versionId: column.varchar(undefined, {length: 255}).primaryKey(),
  payloadId: column.varchar(undefined, {length: 255}).notNull()
})

export interface PayloadRequest {
  versionId: string
  payloadId: string
}

export interface LoadedPayload extends PayloadRequest {
  data: Record<string, unknown>
  source?: EntrySource
}

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
  load?(
    requests: ReadonlyArray<PayloadRequest>
  ): Promise<ReadonlyArray<LoadedPayload>>
}

export interface QueryObserver {
  next(value: unknown): void
  error(error: unknown): void
}

/** Owns one local replica connection. All access goes through its statement queue. */
export class EntryRuntime extends Graph {
  #db: Database
  #config: Config
  #options: RuntimeOptions
  #queue: Promise<unknown> = Promise.resolve()
  #generation = 0
  #listeners = new Set<() => void>()

  constructor(config: Config, db: Database, options: RuntimeOptions = {}) {
    super()
    this.#config = config
    this.#db = db
    this.#options = options
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
      if (revision == null) throw new Error('Missing replica revision')
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
      if (revision == null) throw new Error('Missing replica revision')
      const rows = await this.#db
        .select({entry: EntryIndexTable, payloadId: Payload.payloadId})
        .from(EntryIndexTable)
        .leftJoin(Payload, eq(Payload.versionId, EntryIndexTable.versionId))
      return {
        revision,
        entries: rows.map(({entry, payloadId}) => {
          if (!entry) throw new Error('Missing indexed entry')
          return {entry, payloadId: payloadId ?? undefined}
        })
      }
    })
  }

  static async createSchema(db: Database, revision: string): Promise<void> {
    await db.create(EntryIndexTable, EntryDataTable, Payload, Meta)
    await createSearch(db)
    await db.insert(Meta).values({id: 1, revision})
  }

  /** Trusted handler read, not a browser endpoint or authorization check.
   * Reads only exact resident payloads under the statement queue; never hydrates.
   */
  payloadSnapshot(
    requests: ReadonlyArray<PayloadRequest>
  ): Promise<{revision: string; payloads: Array<LoadedPayload>}> {
    if (requests.length > 100)
      throw new Error('Too many payload snapshot requests')
    const captured = requests.map(request => ({...request}))
    if (
      captured.some(request => !request.versionId || !request.payloadId) ||
      new Set(captured.map(request => request.versionId)).size !==
        captured.length
    )
      throw new Error('Invalid payload snapshot requests')
    return this.#exclusive(async () => {
      const revision = await this.#db
        .select(Meta.revision)
        .from(Meta)
        .where(eq(Meta.id, 1))
        .get()
      if (revision == null) throw new Error('Missing replica revision')
      if (!captured.length) return {revision, payloads: []}
      const rows = await this.#db
        .select({
          versionId: EntryDataTable.versionId,
          payloadId: EntryDataTable.payloadId,
          data: EntryDataTable.data,
          source: EntryDataTable.source
        })
        .from(EntryDataTable)
        .innerJoin(
          Payload,
          and(
            eq(EntryDataTable.versionId, Payload.versionId),
            eq(EntryDataTable.payloadId, Payload.payloadId)
          )
        )
        .where(
          inArray(
            EntryDataTable.versionId,
            captured.map(request => request.versionId)
          )
        )
      const byId = new Map(rows.map(row => [row.versionId, row]))
      const payloads = captured.map(request => {
        const row = byId.get(request.versionId)
        if (!row || row.payloadId !== request.payloadId || !isRecord(row.data))
          throw new Error('Entry payload snapshot is unavailable or stale')
        return {
          ...request,
          data: structuredClone(row.data),
          source: validateSource(row.source ?? undefined)
        }
      })
      return {revision, payloads}
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
            throw new Error('Replica revision mismatch')
          if (delta.toRevision === delta.fromRevision)
            throw new Error('A delta must advance the revision')
          const changed = new Set(delta.removedVersionIds)
          for (const replacement of delta.entries) {
            const row = entryIndexRow(replacement.entry)
            if (changed.has(row.versionId))
              throw new Error('Duplicate entry in delta')
            changed.add(row.versionId)
            if (replacement.data && !replacement.payloadId)
              throw new Error('Entry data requires a payload identity')
            if (replacement.source !== undefined && !replacement.data)
              throw new Error('Source metadata must accompany entry data')
            const existing = await tx
              .select()
              .from(Payload)
              .where(eq(Payload.versionId, row.versionId))
              .get()
            if (
              existing?.payloadId !== replacement.payloadId ||
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
            await tx.delete(Payload).where(eq(Payload.versionId, row.versionId))
            if (replacement.payloadId) {
              await tx.insert(Payload).values({
                versionId: row.versionId,
                payloadId: replacement.payloadId
              })
              if (replacement.data)
                await tx.insert(EntryDataTable).values({
                  versionId: row.versionId,
                  payloadId: replacement.payloadId,
                  data: replacement.data,
                  source: validateSource(replacement.source)
                })
            }
          }
          for (const id of delta.removedVersionIds ?? []) {
            await tx
              .delete(EntryIndexTable)
              .where(eq(EntryIndexTable.versionId, id))
            await tx
              .delete(EntryDataTable)
              .where(eq(EntryDataTable.versionId, id))
            await tx.delete(Payload).where(eq(Payload.versionId, id))
          }
          await tx
            .update(Meta)
            .set({revision: delta.toRevision})
            .where(eq(Meta.id, 1))
        },
        {async: true}
      )
      this.#generation++
    })
    for (const invalidate of this.#listeners) invalidate()
  }

  async #missing(ids: ReadonlyArray<string>): Promise<Array<PayloadRequest>> {
    const missing: Array<PayloadRequest> = []
    for (let offset = 0; offset < ids.length; offset += 100) {
      const batch = ids.slice(offset, offset + 100)
      const manifests = await this.#db
        .select()
        .from(Payload)
        .where(inArray(Payload.versionId, batch))
      if (manifests.length !== batch.length)
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
        ...manifests.filter(
          row => resident.get(row.versionId) !== row.payloadId
        )
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
    // No database transaction is held during transport/decryption.
    const loaded: Array<LoadedPayload> = []
    try {
      for (let offset = 0; offset < requests.length; offset += 100) {
        loaded.push(
          ...(await this.#options.load(requests.slice(offset, offset + 100)))
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
      if (payload?.payloadId !== request.payloadId || !isRecord(payload.data))
        throw new Error(`Incomplete payload response for ${request.versionId}`)
      validateSource(payload.source)
    }
    await this.#exclusive(async () => {
      if (this.#generation !== generation) return
      await this.#db.transaction(
        async tx => {
          for (const request of requests) {
            await tx
              .delete(EntryDataTable)
              .where(eq(EntryDataTable.versionId, request.versionId))
            await tx.insert(EntryDataTable).values({
              versionId: request.versionId,
              payloadId: request.payloadId,
              data: returned.get(request.versionId)!.data,
              source: validateSource(returned.get(request.versionId)!.source)
            })
          }
        },
        {async: true}
      )
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
