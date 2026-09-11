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
import {count, type Database, eq} from 'rado'
import {EntryView} from './entry/EntryView.js'
import {
  DatabaseStateTable,
  EntryIndexTable,
  type EntryIndexTarget
} from './entry/Schema.js'
import {compileEntryQuery} from './query/EntryQuery.js'
import {
  createSearch,
  EntrySearchName,
  rebuildSearch,
  searchQuery,
  type SearchQuery
} from './query/Search.js'
import type {RelationSource} from './query/Relation.js'
import {
  EntrySyncer,
  EntrySyncRoot,
  type EntrySyncTarget
} from './sync/EntrySyncer.js'

interface EntryDatabaseContext {
  nextOverlayId: number
  queue: Promise<unknown>
  syncer: EntrySyncer
}

interface EntryDatabaseInternal {
  context: EntryDatabaseContext
  parent: EntryDatabase
  target: EntrySyncTarget
  view: EntryView
}

export interface EntryDatabaseOptions {
  /** Prepare a complete search plan under the connection's statement queue. */
  search?(input: GraphQuery['search']): Promise<SearchQuery | undefined>
  includedAtBuild?(filePath: string): boolean | Promise<boolean>
  /** The bundled database already contains its complete FTS5 corpus. */
  searchReady?: boolean
  /** A second connection to the same SQLite database, used for synchronization. */
  syncDatabase?: Database
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

/** A queryable entry database or a named copy-on-write view over one. */
export class EntryDatabase extends Graph implements AsyncDisposable {
  #db: Database
  #syncDatabase: Database
  #context: EntryDatabaseContext
  #config: Config
  #entryTarget: EntryIndexTarget
  #target: EntrySyncTarget
  #view?: EntryView
  #detach?: () => void
  #children = new Set<EntryDatabase>()
  #ownsConnections: boolean
  #ownsSyncer: boolean
  #searchName: string
  #options: EntryDatabaseOptions
  #searchDirty = true
  #listeners = new Set<() => void>()
  #syncer: EntrySyncer
  #syncQueue: Promise<unknown> = Promise.resolve()
  #closed = false

  constructor(
    config: Config,
    db: Database,
    options: EntryDatabaseOptions = {},
    internal?: EntryDatabaseInternal
  ) {
    super()
    this.#config = config
    this.#db = db
    this.#syncDatabase = internal ? db : (options.syncDatabase ?? db)
    this.#context = internal?.context ?? {
      nextOverlayId: 1,
      queue: Promise.resolve(),
      syncer: new EntrySyncer(config, db)
    }
    this.#target = internal?.target ?? EntrySyncRoot
    this.#entryTarget = this.#target.entries
    this.#view = internal?.view
    this.#detach = internal
      ? () => internal.parent.#children.delete(this)
      : undefined
    this.#ownsConnections = !internal
    this.#ownsSyncer = !internal && this.#syncDatabase !== db
    this.#syncer = this.#ownsSyncer
      ? new EntrySyncer(config, this.#syncDatabase)
      : this.#context.syncer
    this.#searchName = this.#view?.searchName ?? EntrySearchName
    this.#options = options
    this.#searchDirty = !options.searchReady
  }

  get config(): Config {
    return this.#config
  }

  /** Synchronize a source through this database's single prepared syncer. */
  syncWith(source: Source): Promise<EntrySyncResult> {
    if (this.#closed)
      return Promise.reject(new Error('EntryDatabase is closed'))
    const task = this.#syncQueue.then(async () => {
      const current =
        this.#syncDatabase === this.#db
          ? await this.getRevision()
          : await this.#getRevision(this.#syncDatabase)
      const tree = await source.getTreeIfDifferent(current)
      if (!tree) return {revision: current, changedEntryIds: []}
      const changedEntryIds = await this.#syncSource(source, tree, current)
      return {revision: tree.sha, changedEntryIds}
    })
    this.#syncQueue = task.catch(() => {})
    return task
  }

  async close(): Promise<void> {
    if (this.#closed) return
    if (this.#children.size)
      throw new Error('Cannot close an entry database with active overlays')
    this.#closed = true
    await this.#syncQueue
    await this.#withReadConnection(async () => {
      if (this.#view) {
        await this.#context.syncer.release(this.#target)
        await this.#view.close()
        this.#detach?.()
        return
      }
      await this.#context.syncer.close()
      if (this.#ownsSyncer) await this.#syncer.close()
      if (this.#syncDatabase !== this.#db) await this.#syncDatabase.close()
      if (this.#ownsConnections) await this.#db.close()
    })
  }

  [Symbol.asyncDispose](): Promise<void> {
    return this.close()
  }

  getRevision(): Promise<string> {
    return this.#withReadConnection(() => this.#getRevision(this.#db))
  }

  async #getRevision(db: Database): Promise<string> {
    const state = this.#target.state
    const revision = await db
      .select(state.revision)
      .from(state)
      .where(eq(state.id, 1))
      .get()
    if (revision == null) throw new Error('Missing database revision')
    return revision
  }

  /** Apply one source tree without keeping an in-memory copy of its entries. */
  async #syncSource(
    source: Source,
    tree: ReadonlyTree,
    fromRevision: string
  ): Promise<Array<string>> {
    let changedEntryIds = Array<string>()
    const sync = async () => {
      changedEntryIds = await this.#syncer.sync(
        this.#target,
        source,
        tree,
        fromRevision
      )
      this.#searchDirty = true
    }
    if (this.#syncDatabase === this.#db) await this.#withReadConnection(sync)
    else await sync()
    for (const invalidate of this.#listeners) invalidate()
    return changedEntryIds
  }

  static async createSchema(db: Database, revision: string): Promise<void> {
    await db.create(EntryIndexTable, DatabaseStateTable)
    await createSearch(db)
    await db.insert(DatabaseStateTable).values({id: 1, revision})
  }

  #withReadConnection<T>(run: () => Promise<T>): Promise<T> {
    const task = this.#context.queue.then(run)
    this.#context.queue = task.catch(() => {})
    return task
  }

  /** Create and synchronize a copy-on-write layer over this database. */
  async overlay(source: Source): Promise<EntryDatabase> {
    if (this.#closed) throw new Error('EntryDatabase is closed')
    const name = `overlay_${this.#context.nextOverlayId++}`
    let child: EntryDatabase | undefined
    try {
      const revision = await this.getRevision()
      const view = await this.#withReadConnection(() =>
        EntryView.create(this.#db, name, this.#entryTarget, revision)
      )
      child = new EntryDatabase(this.#config, this.#db, this.#options, {
        context: this.#context,
        parent: this,
        target: {name, entries: view.entries, state: view.state},
        view
      })
      this.#children.add(child)
      await child.syncWith(source)
      return child
    } catch (error) {
      if (child) await child.close()
      throw error
    }
  }

  async resolve<const Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    if (this.#closed) throw new Error('EntryDatabase is closed')
    return this.#withReadConnection(
      () =>
        this.#db.transaction(tx => this.#resolve(query, tx), {
          async: true,
          behavior: 'deferred'
        }) as Promise<AnyQueryResult<Query>>
    )
  }

  async #resolve(
    query: GraphQuery,
    db: Database,
    source?: RelationSource
  ): Promise<unknown> {
    if (source) {
      query = {preferredLocale: source.locale ?? undefined, ...query}
    }
    const search = this.#options.search
      ? await this.#options.search(query.search)
      : searchQuery(query.search, this.#entryTarget, this.#searchName)
    const plan = compileEntryQuery(
      this.#config,
      query,
      source,
      search,
      this.#entryTarget
    )
    if (query.search !== undefined && !this.#options.search)
      await this.#ensureSearch(db)
    const result = await (async () => {
      if (plan.count) {
        const total = await db
          .select(count())
          .from(plan.identities.as('matches'))
          .get()
        return {count: total, rows: []}
      }
      const rows = await (
        plan.fields.length || plan.relations.length
          ? plan.contextRows
          : plan.rows
      ).all(db)
      if (!source && query.get && !rows.length)
        throw new Error('Entry not found')
      return {count: undefined, rows}
    })()
    if (plan.count) return result.count
    const rows: Array<unknown> = []
    for (const row of result.rows) {
      if (!plan.relations.length && !plan.fields.length) {
        rows.push(row)
        continue
      }
      const projected = row as {value: unknown; source: RelationSource}
      let value = projected.value
      const database = this
      const loader: LinkResolver = {
        resolver: {config: this.#config},
        locale: projected.source.locale,
        includedAtBuild(filePath) {
          return database.#options.includedAtBuild?.(filePath) ?? false
        },
        async resolveLinks<P extends Projection>(
          projection: P,
          ids: ReadonlyArray<string>
        ): Promise<Array<InferProjection<P>>> {
          return (await database.#resolve(
            {
              select: projection,
              id: {in: ids},
              status: query.status ?? 'published',
              preferredLocale: projected.source.locale ?? undefined
            },
            db
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
          db,
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
    // Graph's nested projection stage returns undefined for an absent single
    // relation; only the public top-level first/get stage normalizes absence.
    return plan.single ? (source ? rows[0] : (rows[0] ?? null)) : rows
  }

  async #ensureSearch(db: Database): Promise<void> {
    if (!this.#searchDirty) return
    if (this.#view) await createSearch(db, this.#searchName)
    await rebuildSearch(db, this.#entryTarget, this.#searchName)
    this.#searchDirty = false
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
