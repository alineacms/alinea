import type {Config} from '#/core/Config.js'
import type {GraphQuery} from '#/core/Graph.js'
import {isRecord} from '#/core/util/Objects.js'
import {count, type Database, eq, inArray, table} from 'rado'
import * as column from 'rado/universal/columns'
import {
  EntryDataTable,
  EntryIndexTable,
  entryIndexRow,
  type IndexedEntry
} from '../entry/Schema.js'
import {compileEntryQuery} from '../query/EntryQuery.js'
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
}

export interface EntryReplacement {
  entry: IndexedEntry
  /** Omitted for an explore-only entry. */
  payloadId?: string
  data?: Record<string, unknown>
}

export interface EntryDelta {
  fromRevision: string
  toRevision: string
  entries: ReadonlyArray<EntryReplacement>
  removedVersionIds?: ReadonlyArray<string>
}

export interface RuntimeOptions {
  load?(
    requests: ReadonlyArray<PayloadRequest>
  ): Promise<ReadonlyArray<LoadedPayload>>
}

export interface QueryObserver {
  next(value: unknown): void
  error(error: unknown): void
}

/** Owns one local replica connection. All access goes through its statement queue. */
export class EntryRuntime {
  #db: Database
  #config: Config
  #options: RuntimeOptions
  #queue: Promise<unknown> = Promise.resolve()
  #generation = 0
  #listeners = new Set<() => void>()

  constructor(config: Config, db: Database, options: RuntimeOptions = {}) {
    this.#config = config
    this.#db = db
    this.#options = options
  }

  static async createSchema(db: Database, revision: string): Promise<void> {
    await db.create(EntryIndexTable, EntryDataTable, Payload, Meta)
    await db.insert(Meta).values({id: 1, revision})
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
                  data: replacement.data
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
      this.#generation === generation ? this.#missing(ids) : []
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
              data: returned.get(request.versionId)!.data
            })
          }
        },
        {async: true}
      )
    })
  }

  async resolve(query: GraphQuery): Promise<unknown> {
    for (;;) {
      try {
        return await this.#resolve(query, this.#generation)
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
    const plan = compileEntryQuery(this.#config, query, source)
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
      const rows = await plan.rows.all(this.#db)
      if (!source && query.get && !rows.length)
        throw new Error('Entry not found')
      return {count: undefined, rows}
    })
    if (plan.count) return result.count
    const rows: Array<unknown> = []
    for (const row of result.rows) {
      if (!plan.relations.length) {
        rows.push(row)
        continue
      }
      const projected = row as {value: unknown; source: RelationSource}
      let value = projected.value
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
