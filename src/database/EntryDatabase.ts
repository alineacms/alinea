import type {Config} from '#/core/Config.js'
import {
  Graph,
  type AnyQueryResult,
  type GraphQuery,
  type Projection,
  type InferProjection
} from '#/core/Graph.js'
import {Field} from '#/core/Field.js'
import type {
  EntryReference,
  EntryReferenceQuery,
  EntryReferenceResult
} from '#/core/db/EntryReference.js'
import type {LinkResolver} from '#/core/db/LinkResolver.js'
import type {Mutation} from '#/core/db/Mutation.js'
import {Policy} from '#/core/Role.js'
import {OverlaySource} from '#/core/source/OverlaySource.js'
import {ShaMismatchError} from '#/core/source/ShaMismatchError.js'
import {
  SourceTransaction,
  type GetBlobsOptions,
  type RemoteSource,
  type Source
} from '#/core/source/Source.js'
import {ReadonlyTree, type Tree} from '#/core/source/Tree.js'
import {Type} from '#/core/Type.js'
import {isRecord} from '#/core/util/Objects.js'
import {
  and,
  asc,
  count,
  type Database,
  eq,
  gt,
  inArray,
  isNull,
  sql
} from 'rado'
import {EntryView} from './entry/EntryView.js'
import {
  DatabaseMetadataTable,
  DatabaseStateTable,
  EntryIndexTable,
  type EntryIndexTarget
} from './entry/Schema.js'
import {compileEntryQuery} from './query/EntryQuery.js'
import {EntryTransaction} from './EntryTransaction.js'
import type {CommitRequest} from '#/core/db/CommitRequest.js'
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
import {DatabaseSource} from './DatabaseSource.js'

interface EntryDatabaseContext {
  nextOverlayId: number
  queue: Promise<unknown>
  syncer: EntrySyncer
}

interface EntryDatabaseInternal {
  context: EntryDatabaseContext
  parent?: EntryDatabase
  target: EntrySyncTarget
  tree?: ReadonlyTree
  view?: EntryView
  withinTransaction?: boolean
  searchName?: string
  searchDirty?: boolean
}

interface EntryDatabaseState {
  revision: string
  tree: Tree | null
}

const databaseSchemaVersion = 1
const defaultConfigFingerprint = 'runtime'

export interface EntryDatabaseOptions {
  /** Prepare a complete search plan under the connection's statement queue. */
  search?(input: GraphQuery['search']): Promise<SearchQuery | undefined>
  includedAtBuild?(filePath: string): boolean | Promise<boolean>
  /** The bundled database already contains its complete FTS5 corpus. */
  searchReady?: boolean
  /** A second connection to the same SQLite database, used for synchronization. */
  syncDatabase?: Database
}

export interface EntryApplyOptions {
  source: Source
  policy?: Policy
}

export interface QueryObserver {
  next(value: unknown): void
  error(error: unknown): void
}

export type EntryChangeListener = (change: EntrySyncResult) => void

export interface EntrySyncResult {
  revision: string
  /** Includes source changes, deletions, and entries changed by inheritance. */
  changedEntryIds: ReadonlyArray<string>
}

export interface EntryApplyResult extends EntrySyncResult {
  request: CommitRequest
}

export interface EntryDatabaseOverlay extends AsyncDisposable {
  database: EntryDatabase
  source: OverlaySource
  close(): Promise<void>
}

/** A queryable entry database or a named copy-on-write view over one. */
export class EntryDatabase extends Graph implements AsyncDisposable {
  #db: Database
  #syncDatabase: Database
  #context: EntryDatabaseContext
  #config: Config
  #entryTarget: EntryIndexTarget
  #target: EntrySyncTarget
  #tree?: ReadonlyTree
  #view?: EntryView
  #detach?: () => void
  #children = new Set<EntryDatabase>()
  #ownsConnections: boolean
  #ownsSyncer: boolean
  #searchName: string
  #options: EntryDatabaseOptions
  #searchDirty = true
  #listeners = new Set<() => void>()
  #changeListeners = new Set<EntryChangeListener>()
  #syncer: EntrySyncer
  #withinTransaction: boolean
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
    this.#tree = internal?.tree
    this.#entryTarget = this.#target.entries
    this.#view = internal?.view
    const parent = internal?.parent
    this.#detach = parent ? () => parent.#children.delete(this) : undefined
    this.#ownsConnections = !internal
    this.#ownsSyncer = !internal && this.#syncDatabase !== db
    this.#syncer = this.#ownsSyncer
      ? new EntrySyncer(config, this.#syncDatabase)
      : this.#context.syncer
    this.#searchName =
      internal?.searchName ?? this.#view?.searchName ?? EntrySearchName
    this.#options = options
    this.#searchDirty =
      internal?.searchDirty ?? (this.#view ? true : !options.searchReady)
    this.#withinTransaction = internal?.withinTransaction ?? false
  }

  get config(): Config {
    return this.#config
  }

  /** Synchronize a source through this database's single prepared syncer. */
  syncWith(source: RemoteSource): Promise<EntrySyncResult> {
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

  /** Atomically plan and apply mutations through a private database overlay. */
  apply(
    mutations: ReadonlyArray<Mutation>,
    options: EntryApplyOptions
  ): Promise<EntryApplyResult> {
    if (this.#closed)
      return Promise.reject(new Error('EntryDatabase is closed'))
    const task = this.#syncQueue.then(() =>
      this.#applyMutations(mutations, options)
    )
    this.#syncQueue = task.catch(() => {})
    return task
  }

  async #applyMutations(
    mutations: ReadonlyArray<Mutation>,
    options: EntryApplyOptions
  ): Promise<EntryApplyResult> {
    const from = await options.source.getTree()
    const applied = await this.#syncDatabase.transaction(
      async tx => {
        const revision = await this.#getRevision(tx)
        if (revision !== from.sha)
          throw new ShaMismatchError(revision, from.sha)
        const workingSource = new OverlaySource(options.source, from)
        const workingDatabase = new EntryDatabase(
          this.#config,
          tx,
          this.#options,
          {
            context: {
              nextOverlayId: this.#context.nextOverlayId,
              queue: Promise.resolve(),
              syncer: this.#syncer
            },
            target: this.#target,
            tree: from,
            withinTransaction: true,
            searchName: this.#searchName,
            searchDirty: this.#searchDirty
          }
        )
        const transaction = new EntryTransaction(
          workingDatabase,
          workingSource,
          new SourceTransaction(options.source, from),
          from,
          options.policy ?? Policy.ALLOW_ALL
        )
        try {
          await transaction.apply(mutations)
          const request = await transaction.toRequest()
          return {
            result: {
              revision: request.intoSha,
              changedEntryIds: transaction.changedEntryIds,
              request
            },
            tree: await workingSource.getTree()
          }
        } finally {
          await transaction.close()
        }
      },
      {async: true}
    )
    this.#tree = applied.tree
    if (applied.result.changedEntryIds.length) {
      if (this.#view) this.#searchName = this.#view.searchName
      this.#searchDirty = true
    }
    this.#emitChange(applied.result)
    return applied.result
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
      if (this.#ownsConnections) {
        await this.#context.syncer.close()
        if (this.#ownsSyncer) await this.#syncer.close()
        if (this.#syncDatabase !== this.#db) await this.#syncDatabase.close()
        await this.#db.close()
      }
    })
  }

  [Symbol.asyncDispose](): Promise<void> {
    return this.close()
  }

  getRevision(): Promise<string> {
    return this.#withReadConnection(() => this.#getRevision(this.#db))
  }

  async getTree(): Promise<ReadonlyTree> {
    const state = await this.#withReadConnection(() => this.#getState(this.#db))
    if (!state.tree)
      throw new Error(`Database revision ${state.revision} has no source tree`)
    return new ReadonlyTree(state.tree)
  }

  async *getBlobs(
    shas: ReadonlyArray<string>,
    options: GetBlobsOptions = {}
  ): AsyncGenerator<[sha: string, blob: Uint8Array]> {
    const encoder = new TextEncoder()
    const found = new Set<string>()
    for (let offset = 0; offset < shas.length; offset += 400) {
      if (options.signal?.aborted)
        throw options.signal.reason ?? new Error('Blob transfer aborted')
      const requested = shas.slice(offset, offset + 400)
      const rows = await this.#withReadConnection(async () =>
        this.#db
          .select({
            sha: this.#entryTarget.fileHash,
            payload: this.#entryTarget.payload
          })
          .from(this.#entryTarget)
          .where(inArray(this.#entryTarget.fileHash, requested))
          .all()
      )
      for (const row of rows) {
        if (found.has(row.sha)) continue
        found.add(row.sha)
        yield [row.sha, encoder.encode(row.payload)]
      }
    }
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

  async #getState(db: Database): Promise<EntryDatabaseState> {
    const state = this.#target.state
    const result = await db
      .select({revision: state.revision, tree: state.tree})
      .from(state)
      .where(eq(state.id, 1))
      .get()
    if (result == null) throw new Error('Missing database state')
    return result
  }

  /** Apply one source tree without keeping an in-memory copy of its entries. */
  async #syncSource(
    source: RemoteSource,
    tree: ReadonlyTree,
    fromRevision: string
  ): Promise<Array<string>> {
    let changedEntryIds = Array<string>()
    const sync = async () => {
      changedEntryIds = await this.#syncer.sync(
        this.#target,
        source,
        tree,
        fromRevision,
        {
          previousTree: this.#tree,
          withinTransaction: this.#withinTransaction
        }
      )
      this.#tree = tree
      if (changedEntryIds.length) {
        if (this.#view) this.#searchName = this.#view.searchName
        this.#searchDirty = true
      }
    }
    if (this.#syncDatabase === this.#db) await this.#withReadConnection(sync)
    else await sync()
    this.#emitChange({revision: tree.sha, changedEntryIds})
    return changedEntryIds
  }

  #emitChange(change: EntrySyncResult): void {
    for (const invalidate of this.#listeners) invalidate()
    for (const listener of this.#changeListeners) listener(change)
  }

  static async createSchema(
    db: Database,
    revision: string,
    configFingerprint = defaultConfigFingerprint
  ): Promise<void> {
    const schema = await db.get<{name: string}>(sql`
      select name from sqlite_master
      where type = 'table' and name = 'alinea_database_state'
    `)
    const metadata = await db.get<{name: string}>(sql`
      select name from sqlite_master
      where type = 'table' and name = 'alinea_database_metadata'
    `)
    const current = metadata
      ? await db
          .select({
            schemaVersion: DatabaseMetadataTable.schemaVersion,
            configFingerprint: DatabaseMetadataTable.configFingerprint
          })
          .from(DatabaseMetadataTable)
          .where(eq(DatabaseMetadataTable.id, 1))
          .get()
      : undefined
    const compatible =
      schema != null &&
      current?.schemaVersion === databaseSchemaVersion &&
      current.configFingerprint === configFingerprint
    if (!compatible) {
      await db.run(sql`drop table if exists ${sql.identifier(EntrySearchName)}`)
      await db.run(
        sql`drop table if exists ${sql.identifier('alinea_entry_index')}`
      )
      await db.run(
        sql`drop table if exists ${sql.identifier('alinea_database_state')}`
      )
      await db.run(
        sql`drop table if exists ${sql.identifier('alinea_database_metadata')}`
      )
      await db.create(
        EntryIndexTable,
        DatabaseStateTable,
        DatabaseMetadataTable
      )
      await createSearch(db)
      await db.insert(DatabaseMetadataTable).values({
        id: 1,
        schemaVersion: databaseSchemaVersion,
        configFingerprint
      })
    }
    const existing = await db
      .select(DatabaseStateTable.id)
      .from(DatabaseStateTable)
      .where(eq(DatabaseStateTable.id, 1))
      .get()
    if (existing == null)
      await db.insert(DatabaseStateTable).values({
        id: 1,
        revision,
        tree: revision === ReadonlyTree.EMPTY.sha ? ReadonlyTree.EMPTY : null
      })
  }

  async prepareSearch(): Promise<void> {
    await this.#withReadConnection(() => this.#ensureSearch(this.#db))
  }

  async compact(): Promise<void> {
    if (this.#view) throw new Error('Cannot compact an entry database overlay')
    await this.prepareSearch()
    await this.#withReadConnection(async () => {
      await this.#db.run(sql`pragma optimize`)
      await this.#db.run(sql`vacuum`)
    })
  }

  #withReadConnection<T>(run: () => Promise<T>): Promise<T> {
    const task = this.#context.queue.then(run)
    this.#context.queue = task.catch(() => {})
    return task
  }

  /** Create and synchronize a copy-on-write layer over this database. */
  async overlay(source: RemoteSource): Promise<EntryDatabase> {
    if (this.#closed) throw new Error('EntryDatabase is closed')
    const name = `overlay_${this.#context.nextOverlayId++}`
    let child: EntryDatabase | undefined
    try {
      const state = await this.#withReadConnection(() =>
        this.#getState(this.#db)
      )
      const tree =
        this.#tree ?? (state.tree ? new ReadonlyTree(state.tree) : undefined)
      this.#tree = tree
      const view = await this.#withReadConnection(() =>
        EntryView.create(this.#db, name, this.#entryTarget, state.revision)
      )
      child = new EntryDatabase(this.#config, this.#db, this.#options, {
        context: this.#context,
        parent: this,
        target: {
          name,
          entries: view.entries,
          changes: view.changes,
          state: view.state
        },
        tree,
        view,
        searchName: this.#searchDirty ? view.searchName : this.#searchName,
        searchDirty: this.#searchDirty
      })
      this.#children.add(child)
      await child.syncWith(source)
      return child
    } catch (error) {
      if (child) await child.close()
      throw error
    }
  }

  /** Create an initially empty writable source and database layer. */
  async createOverlay(): Promise<EntryDatabaseOverlay> {
    const source = await OverlaySource.create(new DatabaseSource(this))
    const database = await this.overlay(source)
    return {
      database,
      source,
      close: () => database.close(),
      [Symbol.asyncDispose]: () => database.close()
    }
  }

  async resolve<const Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    if (this.#closed) throw new Error('EntryDatabase is closed')
    return this.#withReadConnection(() => {
      if (this.#withinTransaction)
        return this.#resolve(query, this.#db) as Promise<AnyQueryResult<Query>>
      return this.#db.transaction(tx => this.#resolve(query, tx), {
        async: true,
        behavior: 'deferred'
      }) as Promise<AnyQueryResult<Query>>
    })
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
    return plan.single ? (source || rows.length ? rows[0] : null) : rows
  }

  /** Scan references in bounded pages without retaining an entry index. */
  referencesTo(query: EntryReferenceQuery): Promise<EntryReferenceResult> {
    if (this.#closed)
      return Promise.reject(new Error('EntryDatabase is closed'))
    return this.#withReadConnection(() =>
      this.#db.transaction(tx => this.#referencesTo(tx, query), {
        async: true,
        behavior: 'deferred'
      })
    )
  }

  async #referencesTo(
    db: Database,
    query: EntryReferenceQuery
  ): Promise<EntryReferenceResult> {
    const entry = this.#entryTarget
    const status = query.status ?? 'published'
    const conditions = [eq(entry.visible, true)]
    if (query.locale !== undefined)
      conditions.push(
        query.locale === null
          ? isNull(entry.locale)
          : eq(entry.locale, query.locale.toLowerCase())
      )
    if (status === 'preferDraft') conditions.push(eq(entry.active, true))
    else if (status === 'preferPublished') conditions.push(eq(entry.main, true))
    else if (status !== 'all') conditions.push(eq(entry.status, status))

    const references: Array<EntryReference> = []
    const pageSize = 500
    let cursor = ''
    let scanned = 0
    while (true) {
      const rows = await db
        .select({
          versionId: entry.versionId,
          id: entry.id,
          filePath: entry.filePath,
          type: entry.type,
          locale: entry.locale,
          status: entry.status,
          active: entry.active,
          main: entry.main,
          data: entry.data
        })
        .from(entry)
        .where(and(...conditions, gt(entry.versionId, cursor)))
        .orderBy(asc(entry.versionId))
        .limit(pageSize)
        .all()
      if (!rows.length) break
      for (const row of rows) {
        scanned += 1
        const type = this.#config.schema[row.type]
        if (!type) continue
        for (const target of Type.references(type, row.data)) {
          if (target.targetId !== query.targetId) continue
          references.push({
            ...target,
            sourceId: row.id,
            sourceFilePath: row.filePath,
            sourceType: row.type,
            sourceLocale: row.locale,
            sourceStatus: row.status,
            sourceActive: row.active,
            sourceMain: row.main
          })
        }
      }
      cursor = rows.at(-1)!.versionId
      if (rows.length < pageSize) break
    }
    return {
      references,
      total: references.length,
      scan: {scanned, total: scanned, complete: true}
    }
  }

  async #ensureSearch(db: Database): Promise<void> {
    if (!this.#searchDirty) return
    if (this.#view) await createSearch(db, this.#searchName, true)
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

  onChange(listener: EntryChangeListener): () => void {
    if (this.#closed) throw new Error('EntryDatabase is closed')
    this.#changeListeners.add(listener)
    return () => this.#changeListeners.delete(listener)
  }
}
