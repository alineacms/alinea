import type {Config} from '#/core/Config.js'
import type {CommitRequest} from '#/core/db/CommitRequest.js'
import type {
  EntryReferenceQuery,
  EntryReferenceResult
} from '#/core/db/EntryReference.js'
import type {SyncOptions} from '#/core/db/LocalStore.js'
import type {Mutation} from '#/core/db/Mutation.js'
import {Graph, type AnyQueryResult, type GraphQuery} from '#/core/Graph.js'
import {Policy} from '#/core/Role.js'
import type {FileStat} from '#/core/source/FSSource.js'
import {OverlaySource} from '#/core/source/OverlaySource.js'
import {ShaMismatchError} from '#/core/source/ShaMismatchError.js'
import {
  SourceTransaction,
  type GetBlobsOptions,
  type RemoteSource,
  type Source
} from '#/core/source/Source.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {chunks} from '#/core/util/Arrays.js'
import {TaskQueue} from '#/core/util/Async.js'
import {eq, inArray, Rollback, sql, type Database} from 'rado'
import {DatabaseSource} from './DatabaseSource.js'
import {
  DatabaseMetadataTable,
  DatabaseStateTable,
  SourceFileTable
} from './DatabaseTables.js'
import type {DatabaseHandle} from './driver/DatabaseHandle.js'
import {entryDataText, hasJsonbRows, supportsJsonb} from './entry/EntryData.js'
import {
  EntryIndexTable,
  EntryReferenceTable,
  syncFieldIndexes
} from './entry/EntryTable.js'
import {EntryTransaction} from './EntryTransaction.js'
import {queryEntryReferences} from './query/EntryReferences.js'
import {resolveEntryQuery} from './query/ResolveQuery.js'
import {
  createSearch,
  EntrySearchTable,
  fuzzyDistance,
  searchQuery,
  searchTokens,
  SearchVocabulary,
  type SearchQuery
} from './query/Search.js'
import {EntrySyncer} from './sync/EntrySyncer.js'
import {sqliteBatchSize} from './sync/SyncQueries.js'
import {databaseVersion} from './Version.js'

const defaultConfigFingerprint = 'runtime'
/** Temporary table holding the source payloads while a reindex runs. */
const reindexBlobsName = 'alinea_reindex_blobs'

export interface EntryDatabaseOptions {
  includedAtBuild?(filePath: string): boolean | Promise<boolean>
  /** Copy the connection for an overlay; without it there are none. */
  fork?(): Promise<DatabaseHandle>
  /**
   * Whether syncs record the source tree in the state, so the database can be
   * reopened and synced from it. An overlay keeps its tree in memory.
   */
  recordsTree?: boolean
}

export interface EntryApplyOptions {
  source: Source
  policy?: Policy
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

/**
 * A queryable entry index owning its SQLite connection. Mutations are planned
 * on a working copy inside a write transaction of that connection.
 */
export class EntryDatabase extends Graph implements AsyncDisposable {
  #config: Config
  #options: EntryDatabaseOptions
  /** Read connection, or the write transaction of a working copy. */
  #db: Database
  #syncer: EntrySyncer
  /** Serializes every task on the connection. */
  #queue = new TaskQueue()
  #syncQueue = new TaskQueue()
  #tree?: ReadonlyTree
  #initialTree?: ReadonlyTree
  #recordsTree: boolean
  /** The connection is already inside a transaction: never open nested ones. */
  #transactional = false
  #changeListeners = new Set<EntryChangeListener>()
  #vocabulary = new SearchVocabulary()
  #closed = false

  constructor(
    config: Config,
    db: Database,
    options: EntryDatabaseOptions = {}
  ) {
    super()
    this.#config = config
    this.#options = options
    this.#db = db
    this.#syncer = new EntrySyncer(config, db)
    this.#recordsTree = options.recordsTree ?? true
  }

  get config(): Config {
    return this.#config
  }

  /** Whether this database can create overlays. */
  get forkable(): boolean {
    return Boolean(this.#options.fork)
  }

  includedAtBuild(filePath: string): boolean | Promise<boolean> {
    return (
      this.#options.includedAtBuild?.(filePath) ??
      this.#initialTree?.has(filePath) ??
      false
    )
  }

  /** Whether this database was closed, and answers only from a replacement. */
  get closed(): boolean {
    return this.#closed
  }

  #assertOpen(): void {
    if (this.#closed) throw new Error('EntryDatabase is closed')
  }

  /**
   * Run a task while no other task uses the connection, so no transaction
   * is open: a fork of the connection then copies committed state.
   */
  whileIdle<T>(task: () => Promise<T>): Promise<T> {
    this.#assertOpen()
    return this.#queue.run(task)
  }

  /**
   * Fork the connection and synchronize the copy with a source. The overlay
   * shares every unchanged page with this database and is independent of it:
   * either can change or close without affecting the other.
   */
  async overlay(source: RemoteSource): Promise<EntryDatabase> {
    const fork = this.#options.fork
    if (!fork) throw new Error('This entry database cannot be forked')
    this.#assertOpen()
    // Copy the connection while no task runs on it.
    const {copy, tree} = await this.#queue.run(async () => {
      const {tree} = await this.#readTreeState()
      return {copy: await fork(), tree}
    })
    const overlay = new EntryDatabase(this.#config, copy.database, {
      ...this.#options,
      fork: copy.fork,
      recordsTree: false
    })
    overlay.#tree = tree
    try {
      await overlay.syncWith(source)
      return overlay
    } catch (error) {
      await overlay.close()
      throw error
    }
  }

  static async createSchema(
    db: Database,
    config: Config,
    revision: string,
    configFingerprint = defaultConfigFingerprint
  ): Promise<void> {
    const tables = [
      EntryIndexTable,
      EntryReferenceTable,
      DatabaseStateTable,
      DatabaseMetadataTable,
      SourceFileTable
    ]
    const rows = await db.all<{name: string}>(sql`
      select name from sqlite_master
      where type = 'table' and name in (
        'alinea_database_state',
        'alinea_database_metadata',
        'alinea_source_file'
      )
    `)
    const present = new Set(rows.map(row => row.name))
    // Older layouts lack the version column: read whichever columns exist.
    const current = present.has('alinea_database_metadata')
      ? await db.get<{configFingerprint: string; version?: number}>(
          sql`select * from ${DatabaseMetadataTable} where id = 1`
        )
      : undefined
    // Rows stored as JSONB need a SQLite that reads it.
    const compatible =
      present.has('alinea_database_state') &&
      present.has('alinea_source_file') &&
      current?.version === databaseVersion &&
      current.configFingerprint === configFingerprint &&
      ((await supportsJsonb(db)) || !(await hasJsonbRows(db)))
    if (!compatible) {
      // The FTS5 virtual table is not part of the declared schema.
      await db.run(sql`drop table if exists ${EntrySearchTable}`)
      await db.drop(...tables)
      await db.create(...tables)
      await createSearch(db)
      await db.insert(DatabaseMetadataTable).values({
        id: 1,
        version: databaseVersion,
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
    await syncFieldIndexes(db, config)
  }

  /**
   * Synchronize a source through this database's single prepared syncer,
   * without keeping an in-memory copy of its entries.
   */
  async syncWith(
    source: RemoteSource,
    options?: SyncOptions
  ): Promise<EntrySyncResult> {
    this.#assertOpen()
    return this.#syncQueue.run(async () => {
      const current = await this.#queue.run(() => this.#getRevision(this.#db))
      const tree = await source.getTreeIfDifferent(current)
      if (!tree) return {revision: current, changedEntryIds: []}
      this.#initialTree ??= tree
      const changedEntryIds = await this.#queue.run(async () => {
        const changed = await this.#syncer.sync(source, tree, current, {
          previousTree: this.#tree,
          withinTransaction: this.#transactional,
          validate: options?.validate ?? true,
          recordsTree: this.#recordsTree
        })
        this.#tree = tree
        return changed
      })
      const change = {revision: tree.sha, changedEntryIds}
      this.#emitChange(change)
      return change
    })
  }

  /**
   * Adopt another config and derive every entry again from the payloads this
   * database stores, recording the fingerprint so a later open recognizes the
   * database as written by that config. The rows of the previous config are
   * replaced within one transaction, so reads keep answering from them until
   * the replacement is committed.
   */
  async reindex(
    config: Config,
    configFingerprint = defaultConfigFingerprint
  ): Promise<EntrySyncResult> {
    this.#assertOpen()
    return this.#syncQueue.run(async () => {
      this.#config = config
      await this.#syncer.reconfigure(config)
      const state = DatabaseStateTable
      const entries = EntryIndexTable
      const blobs = sql.identifier(reindexBlobsName)
      const encoder = new TextEncoder()
      const result = await this.#queue.run(async () => {
        // Read outside the transaction: queries on the connection itself would
        // wait for the transaction to finish.
        const {tree} = await this.#readTreeState()
        if (!tree)
          throw new Error('Cannot reindex a database without a source tree')
        return this.#db.transaction(
          async tx => {
            // The stored payloads are the exact source files of the recorded
            // tree, so they feed the sync back in without an external source.
            await tx.run(sql`drop table if exists temp.${blobs}`)
            await tx.run(sql`create temp table ${blobs} as
              select ${entries.fileHash} as sha,
                coalesce(${entries.payload}, ${entryDataText(entries)}) as blob
              from ${entries}`)
            await tx.delete(entries)
            await tx.delete(EntrySearchTable)
            await tx.delete(EntryReferenceTable)
            await tx
              .update(state)
              .set({revision: ReadonlyTree.EMPTY.sha, tree: ReadonlyTree.EMPTY})
              .where(eq(state.id, 1))
            await tx
              .update(DatabaseMetadataTable)
              .set({configFingerprint})
              .where(eq(DatabaseMetadataTable.id, 1))
            await syncFieldIndexes(tx, config)
            const snapshot: RemoteSource = {
              async getTreeIfDifferent() {
                return tree
              },
              async *getBlobs(shas) {
                for (const batch of chunks(shas, 400)) {
                  const rows = await tx.all<{sha: string; blob: string}>(
                    sql`select sha, blob from temp.${blobs}
                      where sha in (${sql.join(
                        batch.map(sha => sql.value(sha)),
                        sql`, `
                      )})`
                  )
                  for (const row of rows)
                    yield [row.sha, encoder.encode(row.blob)] as const
                }
              }
            }
            try {
              const changedEntryIds = await this.#syncer.sync(
                snapshot,
                tree,
                ReadonlyTree.EMPTY.sha,
                {
                  previousTree: ReadonlyTree.EMPTY,
                  withinTransaction: true,
                  validate: true,
                  recordsTree: this.#recordsTree
                }
              )
              return {revision: tree.sha, changedEntryIds, tree}
            } finally {
              await tx.run(sql`drop table if exists temp.${blobs}`)
            }
          },
          {async: true}
        )
      })
      this.#tree = result.tree
      // The revision stayed, the indexed text did not.
      this.#vocabulary = new SearchVocabulary()
      const change = {
        revision: result.revision,
        changedEntryIds: result.changedEntryIds
      }
      this.#emitChange(change)
      return change
    })
  }

  /** Atomically plan and apply mutations through a private working copy. */
  async apply(
    mutations: ReadonlyArray<Mutation>,
    options: EntryApplyOptions
  ): Promise<EntryApplyResult> {
    this.#assertOpen()
    return this.#syncQueue.run(async () => {
      const result = await this.#transact(mutations, options, true)
      this.#emitChange(result)
      return result
    })
  }

  /** Plan mutations like apply, then roll them back. */
  async plan(
    mutations: ReadonlyArray<Mutation>,
    options: EntryApplyOptions
  ): Promise<CommitRequest> {
    this.#assertOpen()
    return this.#syncQueue.run(async () => {
      const result = await this.#transact(mutations, options, false)
      return result.request
    })
  }

  async #transact(
    mutations: ReadonlyArray<Mutation>,
    options: EntryApplyOptions,
    commit: boolean
  ): Promise<EntryApplyResult> {
    const from = await options.source.getTree()
    return this.#withWorkingCopy(
      commit,
      async working => {
        const revision = await working.getRevision()
        if (revision !== from.sha)
          throw new ShaMismatchError(revision, from.sha)
        const workingSource = new OverlaySource(options.source, from)
        // Moved files are read from the working copy: a source reading this
        // connection would wait for the held read queue.
        const transaction = new EntryTransaction(
          working,
          workingSource,
          new SourceTransaction(new DatabaseSource(working), from),
          from,
          options.policy ?? Policy.ALLOW_ALL
        )
        try {
          await transaction.apply(mutations)
          const request = await transaction.toRequest()
          // Set while the connection is held: reads after the commit find
          // the tree, which the state may not record.
          if (commit) this.#tree = await workingSource.getTree()
          return {
            revision: request.intoSha,
            changedEntryIds: transaction.changedEntryIds,
            request
          }
        } finally {
          await transaction.close()
        }
      },
      from
    )
  }

  /**
   * Resolve a query with a source synced into this database, within a write
   * transaction that is rolled back afterwards.
   */
  async resolveWith<const Query extends GraphQuery>(
    source: RemoteSource,
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    this.#assertOpen()
    return this.#withWorkingCopy(false, async working => {
      await working.syncWith(source)
      return working.resolve(query)
    })
  }

  /**
   * Run a task on a working copy of this database inside a write transaction
   * that holds the read connection, so no read observes it before it commits
   * or rolls back. A rolled back task still returns its result.
   */
  #withWorkingCopy<T>(
    commit: boolean,
    run: (working: EntryDatabase) => Promise<T>,
    from?: ReadonlyTree
  ): Promise<T> {
    return this.#queue.run(async () => {
      const tree = from ?? (await this.#readTreeState()).tree
      try {
        return await this.#db.transaction(
          async tx => {
            const working = new EntryDatabase(this.#config, tx, {
              includedAtBuild: this.#options.includedAtBuild,
              // A rolled back transaction discards the tree it would record.
              recordsTree: commit && this.#recordsTree
            })
            working.#syncer = this.#syncer
            working.#tree = tree
            working.#transactional = true
            const result = await run(working)
            return commit ? result : tx.rollback(result)
          },
          {async: true}
        )
      } catch (error) {
        if (!commit && error instanceof Rollback) return error.data as T
        throw error
      }
    })
  }

  async close(): Promise<void> {
    if (this.#closed) return
    this.#closed = true
    await this.#syncQueue.drain()
    await this.#queue.run(async () => {
      await this.#syncer.close()
      await this.#db.close()
    })
  }

  [Symbol.asyncDispose](): Promise<void> {
    return this.close()
  }

  getRevision(): Promise<string> {
    return this.#queue.run(() => this.#getRevision(this.#db))
  }

  async getTree(): Promise<ReadonlyTree> {
    const state = await this.#queue.run(() => this.#readTreeState())
    if (!state.tree)
      throw new Error(`Database revision ${state.revision} has no source tree`)
    return state.tree
  }

  async #readTreeState() {
    if (this.#tree) {
      const revision = await this.#getRevision(this.#db)
      if (this.#tree.sha === revision) return {revision, tree: this.#tree}
    }
    const state = DatabaseStateTable
    const row = await this.#db
      .select({revision: state.revision, tree: state.tree})
      .from(state)
      .where(eq(state.id, 1))
      .get()
    if (row == null) throw new Error('Missing database state')
    this.#tree = row.tree ? new ReadonlyTree(row.tree) : undefined
    return {revision: row.revision, tree: this.#tree}
  }

  async *getBlobs(
    shas: ReadonlyArray<string>,
    options: GetBlobsOptions = {}
  ): AsyncGenerator<[sha: string, blob: Uint8Array]> {
    const encoder = new TextEncoder()
    const requested = new Set(shas)
    for (const batch of chunks(shas, 400)) {
      if (options.signal?.aborted)
        throw options.signal.reason ?? new Error('Blob transfer aborted')
      const target = EntryIndexTable
      const rows = await this.#queue.run(async () => {
        // Find blobs by their indexed file path: no index covers the hash
        const {tree} = await this.#readTreeState()
        const paths = batch.flatMap(sha => tree?.pathOf(sha) ?? [])
        if (!paths.length) return []
        return this.#db
          .select({
            sha: target.fileHash,
            payload: sql<string>`coalesce(${target.payload}, ${entryDataText(target)})`
          })
          .from(target)
          .where(inArray(target.filePath, paths))
          .all()
      })
      for (const row of rows)
        if (requested.delete(row.sha))
          yield [row.sha, encoder.encode(row.payload)]
    }
  }

  async #getRevision(db: Database): Promise<string> {
    const state = DatabaseStateTable
    const revision = await db
      .select(state.revision)
      .from(state)
      .where(eq(state.id, 1))
      .get()
    if (revision == null) throw new Error('Missing database revision')
    return revision
  }

  #emitChange(change: EntrySyncResult): void {
    for (const listener of this.#changeListeners) listener(change)
  }

  async resolve<const Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    this.#assertOpen()
    return this.#queue.run(() => {
      if (this.#transactional)
        return this.#resolve(query, this.#db) as Promise<AnyQueryResult<Query>>
      return this.#db.transaction(tx => this.#resolve(query, tx), {
        async: true,
        behavior: 'deferred'
      }) as Promise<AnyQueryResult<Query>>
    })
  }

  #resolve(query: GraphQuery, database: Database): Promise<unknown> {
    return resolveEntryQuery(query, {
      config: this.#config,
      database,
      search: input => this.#searchPlan(database, input),
      includedAtBuild: filePath =>
        this.#options.includedAtBuild?.(filePath) ?? false
    })
  }

  /** Scan references in bounded pages without retaining an entry index. */
  async referencesTo(
    query: EntryReferenceQuery
  ): Promise<EntryReferenceResult> {
    this.#assertOpen()
    return this.#queue.run(() =>
      this.#db.transaction(
        tx => queryEntryReferences(this.#config, tx, query),
        {
          async: true,
          behavior: 'deferred'
        }
      )
    )
  }

  /**
   * Plan a search whose tokens also match indexed terms within a small edit
   * distance, loading the vocabulary of the index when that changed.
   */
  async #searchPlan(
    db: Database,
    input: GraphQuery['search']
  ): Promise<SearchQuery | undefined> {
    const tokens = searchTokens(input)
    if (!tokens) return undefined
    // Short tokens only match as prefixes; the vocabulary stays unloaded.
    if (!tokens.some(token => fuzzyDistance(token) > 0))
      return searchQuery(input, EntryIndexTable)
    await this.#vocabulary.load(db, await this.#getRevision(db))
    return searchQuery(input, EntryIndexTable, {
      alternatives: token => this.#vocabulary.alternatives(token)
    })
  }

  onChange(listener: EntryChangeListener): () => void {
    this.#assertOpen()
    this.#changeListeners.add(listener)
    return () => this.#changeListeners.delete(listener)
  }

  /** File stats recorded by the last filesystem sync of this database. */
  async getSourceFileStats(): Promise<Map<string, FileStat>> {
    return this.#queue.run(async () => {
      const rows = await this.#db
        .select({
          path: SourceFileTable.path,
          mtime: SourceFileTable.mtime,
          size: SourceFileTable.size
        })
        .from(SourceFileTable)
      return new Map(
        rows.map(row => [row.path, {mtimeMs: row.mtime, size: row.size}])
      )
    })
  }

  /** Replace the recorded file stats after syncing from a filesystem source. */
  async setSourceFileStats(
    stats: ReadonlyMap<string, FileStat>
  ): Promise<void> {
    const rows = Array.from(stats, ([path, stat]) => ({
      path,
      mtime: stat.mtimeMs,
      size: stat.size
    }))
    await this.#queue.run(() =>
      this.#db.transaction(
        async tx => {
          await tx.delete(SourceFileTable)
          for (const batch of chunks(rows, sqliteBatchSize))
            await tx.insert(SourceFileTable).values(batch)
        },
        {async: true}
      )
    )
  }

  async compact(): Promise<void> {
    await this.#queue.run(async () => {
      await this.#db.run(sql`pragma optimize`)
      // Rewriting the whole file only pays off when it has pages to reclaim.
      const free = await this.#db.get<{freelist_count: number}>(
        sql`pragma freelist_count`
      )
      if (free?.freelist_count) await this.#db.run(sql`vacuum`)
    })
  }
}
