import type {Config} from '#/core/Config.js'
import type {CommitRequest} from '#/core/db/CommitRequest.js'
import type {
  EntryReferenceQuery,
  EntryReferenceResult
} from '#/core/db/EntryReference.js'
import type {Mutation} from '#/core/db/Mutation.js'
import type {SyncOptions} from '#/core/db/LocalStore.js'
import {Graph, type AnyQueryResult, type GraphQuery} from '#/core/Graph.js'
import {Policy} from '#/core/Role.js'
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
import {entryDataText} from './entry/EntryData.js'
import {EntryView} from './entry/EntryView.js'
import {EntryTransaction} from './EntryTransaction.js'
import {queryEntryReferences} from './query/EntryReferences.js'
import {resolveEntryQuery} from './query/ResolveQuery.js'
import {
  type SearchQuery,
  fuzzyDistance,
  searchQuery,
  searchTokens,
  SearchVocabulary
} from './query/Search.js'
import {EntrySyncer, type EntrySyncTarget} from './sync/EntrySyncer.js'

/** Temporary table holding the source payloads while a reindex runs. */
const reindexBlobsName = 'alinea_reindex_blobs'
/** Overlay tables are temporary, so their names are unique per connection. */
const overlayIds = new WeakMap<Database, number>()

export interface EntryLayerState {
  /** Read connection, or the write transaction of a working layer. */
  db: Database
  /** Serializes every task on the connection, shared by its overlays. */
  queue: TaskQueue
  syncer: EntrySyncer
  target: EntrySyncTarget
  /** The copy-on-write table behind an overlay's target. */
  view?: EntryView
  /** The layer an overlay was created from. */
  parent?: EntryLayer
  tree?: ReadonlyTree
  initialTree?: ReadonlyTree
  /** The connection is already inside a transaction: never open nested ones. */
  transactional?: boolean
}

export interface EntryDatabaseOptions {
  includedAtBuild?(filePath: string): boolean | Promise<boolean>
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

export interface EntryDatabaseOverlay extends AsyncDisposable {
  database: EntryLayer
  source: OverlaySource
  close(): Promise<void>
}

/** One queryable layer of the entry index: a database or a view over one. */
export class EntryLayer extends Graph implements AsyncDisposable {
  #config: Config
  #options: EntryDatabaseOptions
  #db: Database
  #queue: TaskQueue
  #syncer: EntrySyncer
  #target: EntrySyncTarget
  #view?: EntryView
  #parent?: EntryLayer
  #tree?: ReadonlyTree
  #initialTree?: ReadonlyTree
  #transactional: boolean
  #children = new Set<EntryLayer>()
  #changeListeners = new Set<EntryChangeListener>()
  #syncQueue = new TaskQueue()
  #vocabulary = new SearchVocabulary()
  #closed = false

  constructor(
    config: Config,
    options: EntryDatabaseOptions,
    state: EntryLayerState
  ) {
    super()
    this.#config = config
    this.#options = options
    this.#db = state.db
    this.#queue = state.queue
    this.#syncer = state.syncer
    this.#target = state.target
    this.#view = state.view
    this.#parent = state.parent
    this.#tree = state.tree
    this.#initialTree = state.initialTree
    this.#transactional = state.transactional ?? false
  }

  /** Where reads go: the parent's tables while the overlay is unwritten. */
  get #readTarget(): EntrySyncTarget {
    return this.#view?.readTarget ?? this.#target
  }

  get config(): Config {
    return this.#config
  }

  includedAtBuild(filePath: string): boolean | Promise<boolean> {
    return (
      this.#options.includedAtBuild?.(filePath) ??
      this.#initialTree?.has(filePath) ??
      false
    )
  }

  /** Whether this layer was closed, and answers only from a replacement. */
  get closed(): boolean {
    return this.#closed
  }

  #assertOpen(): void {
    if (this.#closed) throw new Error('EntryDatabase is closed')
  }

  /**
   * Synchronize a source through this layer's single prepared syncer, without
   * keeping an in-memory copy of its entries.
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
        await this.#view?.diverge()
        const changed = await this.#syncer.sync(
          this.#target,
          source,
          tree,
          current,
          {
            // Another instance on the same database file (the dev server and
            // the site, or a restarted process) may have moved the revision on,
            // then the stored tree is the one to diff against
            previousTree: this.#tree?.sha === current ? this.#tree : undefined,
            withinTransaction: this.#transactional,
            validate: options?.validate ?? true
          }
        )
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
   * layer stores. The rows of the previous config are replaced within one
   * transaction, so reads keep answering from them until the replacement is
   * committed. Only a layer without overlays can be reindexed.
   */
  protected async reindexEntries(
    config: Config,
    reset?: (tx: Database) => Promise<void>
  ): Promise<EntrySyncResult> {
    this.#assertOpen()
    if (this.#children.size)
      throw new Error('Cannot reindex an entry database with active overlays')
    return this.#syncQueue.run(async () => {
      this.#config = config
      await this.#syncer.reconfigure(config)
      const state = this.#target.state
      const entries = this.#target.entries
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
            await tx.delete(this.#target.search)
            await tx
              .update(state)
              .set({revision: ReadonlyTree.EMPTY.sha, tree: ReadonlyTree.EMPTY})
              .where(eq(state.id, 1))
            await reset?.(tx)
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
                this.#target,
                snapshot,
                tree,
                ReadonlyTree.EMPTY.sha,
                {
                  previousTree: ReadonlyTree.EMPTY,
                  withinTransaction: true,
                  validate: true
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

  /** Atomically plan and apply mutations through a private working layer. */
  async apply(
    mutations: ReadonlyArray<Mutation>,
    options: EntryApplyOptions
  ): Promise<EntryApplyResult> {
    this.#assertOpen()
    return this.#syncQueue.run(async () => {
      const {result, tree} = await this.#transact(mutations, options, true)
      this.#tree = tree
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
      const {result} = await this.#transact(mutations, options, false)
      return result.request
    })
  }

  /**
   * Run mutations in a write transaction that holds the read connection, so
   * no read observes it before it commits or rolls back.
   */
  async #transact(
    mutations: ReadonlyArray<Mutation>,
    options: EntryApplyOptions,
    commit: boolean
  ): Promise<{result: EntryApplyResult; tree: ReadonlyTree}> {
    const from = await options.source.getTree()
    return this.#queue.run(async () => {
      await this.#view?.diverge()
      let planned: {result: EntryApplyResult; tree: ReadonlyTree} | undefined
      try {
        return await this.#db.transaction(
          async tx => {
            const revision = await this.#getRevision(tx)
            if (revision !== from.sha)
              throw new ShaMismatchError(revision, from.sha)
            const workingSource = new OverlaySource(options.source, from)
            // The working copy of this layer inside the write transaction.
            const workingLayer = new EntryLayer(this.#config, this.#options, {
              db: tx,
              queue: new TaskQueue(),
              syncer: this.#syncer,
              target: this.#target,
              tree: from,
              transactional: true
            })
            // Moved files are read from the working layer: a source reading
            // this connection would wait for the held read queue.
            const transaction = new EntryTransaction(
              workingLayer,
              workingSource,
              new SourceTransaction(new DatabaseSource(workingLayer), from),
              from,
              options.policy ?? Policy.ALLOW_ALL
            )
            try {
              await transaction.apply(mutations)
              const request = await transaction.toRequest()
              planned = {
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
            if (!commit) tx.rollback()
            return planned
          },
          {async: true}
        )
      } catch (error) {
        if (planned && error instanceof Rollback) return planned
        throw error
      }
    })
  }

  async close(): Promise<void> {
    if (this.#closed) return
    if (this.#children.size)
      throw new Error('Cannot close an entry database with active overlays')
    this.#closed = true
    await this.#syncQueue.drain()
    await this.#queue.run(async () => {
      if (this.#view) {
        await this.#syncer.release(this.#target)
        await this.#view.close()
      }
      await this.releaseLayer()
    })
    if (this.#parent) this.#parent.#children.delete(this)
  }

  /** Release what this layer owns, serialized with the read connection. */
  protected async releaseLayer(): Promise<void> {}

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
    const state = this.#target.state
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
      const target = this.#readTarget.entries
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
    const state = this.#target.state
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

  /** Run a task serialized with every other read on this connection. */
  protected withReadConnection<T>(run: () => Promise<T>): Promise<T> {
    return this.#queue.run(run)
  }

  /** Create and synchronize a copy-on-write layer over this one. */
  async overlay(source: RemoteSource): Promise<EntryLayer> {
    this.#assertOpen()
    const id = (overlayIds.get(this.#db) ?? 0) + 1
    overlayIds.set(this.#db, id)
    const name = `overlay_${id}`
    let child: EntryLayer | undefined
    try {
      const {revision, tree} = await this.#queue.run(() =>
        this.#readTreeState()
      )
      const view = await this.#queue.run(() =>
        EntryView.create(this.#db, name, this.#target, revision)
      )
      child = new EntryLayer(this.#config, this.#options, {
        db: this.#db,
        queue: this.#queue,
        syncer: this.#syncer,
        target: view.target,
        tree,
        initialTree: this.#initialTree,
        view,
        parent: this
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
    const target = this.#readTarget
    return resolveEntryQuery(query, {
      config: this.#config,
      database,
      entries: target.entries,
      searchTable: target.search,
      search: input => this.#searchPlan(database, target, input),
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
        tx =>
          queryEntryReferences(
            this.#config,
            tx,
            this.#readTarget.entries,
            query
          ),
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
    target: EntrySyncTarget,
    input: GraphQuery['search']
  ): Promise<SearchQuery | undefined> {
    const tokens = searchTokens(input)
    if (!tokens) return undefined
    // Short tokens only match as prefixes; the vocabulary stays unloaded.
    if (!tokens.some(token => fuzzyDistance(token) > 0))
      return searchQuery(input, target.entries, target.search)
    const {state} = target
    const revision = await db
      .select(state.revision)
      .from(state)
      .where(eq(state.id, 1))
      .get()
    await this.#vocabulary.load(db, target.search, revision ?? '')
    return searchQuery(input, target.entries, target.search, {
      alternatives: token => this.#vocabulary.alternatives(token)
    })
  }

  onChange(listener: EntryChangeListener): () => void {
    this.#assertOpen()
    this.#changeListeners.add(listener)
    return () => this.#changeListeners.delete(listener)
  }
}
