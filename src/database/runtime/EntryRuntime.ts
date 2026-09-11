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
import type {ReadonlyTree} from '#/core/source/Tree.js'
import type {Source} from '#/core/source/Source.js'
import {isRecord} from '#/core/util/Objects.js'
import {count, type Database, eq, inArray, table} from 'rado'
import * as column from 'rado/universal/columns'
import {
  EntryIndexTable,
  entryIndexRow,
  type IndexedEntry
} from '../entry/Schema.js'
import {compileEntryQuery} from '../query/EntryQuery.js'
import {createSearch, rebuildSearch, type SearchQuery} from '../query/Search.js'
import type {RelationSource} from '../query/Relation.js'
import {EntrySyncer} from '../sync/EntrySyncer.js'

const superseded = Symbol('superseded query')

const Meta = table('alinea_database_state', {
  id: column.integer().primaryKey(),
  revision: column.text().notNull()
})

function* chunks<T>(
  items: ReadonlyArray<T>,
  size: number
): Generator<Array<T>> {
  for (let offset = 0; offset < items.length; offset += size)
    yield items.slice(offset, offset + size)
}

async function insertEntries(
  db: Database,
  entries: Iterable<EntryReplacement>
): Promise<void> {
  let rows = Array<ReturnType<typeof entryIndexRow>>()
  for (const replacement of entries) {
    rows.push(entryIndexRow(replacement.entry))
    if (rows.length < 1000) continue
    await db.insert(EntryIndexTable).values(rows)
    rows = []
  }
  if (rows.length) await db.insert(EntryIndexTable).values(rows)
}

export interface EntryReplacement {
  entry: IndexedEntry
}

export interface EntryDelta {
  fromRevision: string
  toRevision: string
  /**
   * Replaces every authored version belonging to these entry IDs. Entries not
   * supplied for an ID are deleted, which handles removed source versions.
   */
  replaceEntryIds?: ReadonlyArray<string>
  /** Replace the entire row set; used only when no prior source cache exists. */
  replaceAll?: boolean
  /** May stream rows; SQLite consumes them inside the commit transaction. */
  entries: Iterable<EntryReplacement>
}

export interface RuntimeOptions {
  /** Prepare a complete search plan under the connection's statement queue. */
  search?(input: GraphQuery['search']): Promise<SearchQuery | undefined>
  includedAtBuild?(filePath: string): boolean | Promise<boolean>
  /** The bundled database already contains its complete FTS5 corpus. */
  searchReady?: boolean
}

export interface QueryObserver {
  next(value: unknown): void
  error(error: unknown): void
}

export interface EntrySyncResult {
  revision: string
  /** Includes source changes, deletions, and entries changed by inheritance. */
  changedEntryIds: ReadonlyArray<string>
}

/** Owns one local database connection. All access uses its statement queue. */
export class EntryRuntime extends Graph implements AsyncDisposable {
  #db: Database
  #config: Config
  #options: RuntimeOptions
  #queue: Promise<unknown> = Promise.resolve()
  #generation = 0
  #searchDirty = true
  #listeners = new Set<() => void>()
  #syncer: EntrySyncer
  #syncQueue: Promise<unknown> = Promise.resolve()
  #closed = false

  constructor(config: Config, db: Database, options: RuntimeOptions = {}) {
    super()
    this.#config = config
    this.#db = db
    this.#syncer = new EntrySyncer(config, db)
    this.#options = options
    this.#searchDirty = !options.searchReady
  }

  get config(): Config {
    return this.#config
  }

  /** Synchronize a source through this database's single prepared syncer. */
  syncWith(source: Source): Promise<EntrySyncResult> {
    if (this.#closed) return Promise.reject(new Error('EntryRuntime is closed'))
    const task = this.#syncQueue.then(async () => {
      const current = await this.getRevision()
      const tree = await source.getTreeIfDifferent(current)
      if (!tree) return {revision: current, changedEntryIds: []}
      const changedEntryIds = await this.syncSource(source, tree, current)
      return {revision: tree.sha, changedEntryIds}
    })
    this.#syncQueue = task.catch(() => {})
    return task
  }

  async close(): Promise<void> {
    if (this.#closed) return
    this.#closed = true
    await this.#syncQueue
    await this.#exclusive(async () => {
      await this.#syncer.close()
      await this.#db.close()
    })
  }

  [Symbol.asyncDispose](): Promise<void> {
    return this.close()
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

  /** Apply one source tree without keeping an in-memory copy of its entries. */
  async syncSource(
    source: Source,
    tree: ReadonlyTree,
    fromRevision: string
  ): Promise<Array<string>> {
    let changedEntryIds = Array<string>()
    await this.#exclusive(async () => {
      changedEntryIds = await this.#syncer.sync(source, tree, fromRevision)
      this.#generation++
      this.#searchDirty = true
    })
    for (const invalidate of this.#listeners) invalidate()
    return changedEntryIds
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

  static async createSchema(db: Database, revision: string): Promise<void> {
    await db.create(EntryIndexTable, Meta)
    await createSearch(db)
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
            throw new Error('Database revision mismatch')
          if (delta.toRevision === delta.fromRevision)
            throw new Error('A delta must advance the revision')
          if (
            delta.replaceAll ||
            (await tx.select(count()).from(EntryIndexTable).get()) === 0
          ) {
            if (delta.replaceAll) await tx.delete(EntryIndexTable)
            await insertEntries(tx, delta.entries)
            await tx
              .update(Meta)
              .set({revision: delta.toRevision})
              .where(eq(Meta.id, 1))
            return
          }
          if (!delta.replaceEntryIds)
            throw new Error(
              'A non-initial delta must declare the entry identities it replaces'
            )
          for (const ids of chunks(delta.replaceEntryIds, 500))
            await tx
              .delete(EntryIndexTable)
              .where(inArray(EntryIndexTable.id, ids))
          await insertEntries(tx, delta.entries)
          await tx
            .update(Meta)
            .set({revision: delta.toRevision})
            .where(eq(Meta.id, 1))
        },
        {async: true}
      )
      this.#generation++
      this.#searchDirty = true
    })
    for (const invalidate of this.#listeners) invalidate()
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
    if (source) {
      query = {preferredLocale: source.locale ?? undefined, ...query}
    }
    const search = this.#options.search
      ? await this.#exclusive(() => this.#options.search!(query.search))
      : undefined
    const plan = compileEntryQuery(this.#config, query, source, search)
    if (query.search !== undefined && !this.#options.search)
      await this.#ensureSearch()
    if (this.#generation !== generation) throw superseded
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
