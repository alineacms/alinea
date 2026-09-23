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
import {ReadonlyTree, type Tree} from '#/core/source/Tree.js'
import {chunks} from '#/core/util/Arrays.js'
import {TaskQueue} from '#/core/util/Async.js'
import {eq, inArray, sql, type Database} from 'rado'
import {DatabaseSource} from './DatabaseSource.js'
import {entryDataText} from './entry/EntryData.js'
import {EntryView} from './entry/EntryView.js'
import type {EntryIndexTarget} from './entry/EntryTable.js'
import {EntryTransaction} from './EntryTransaction.js'
import {queryEntryReferences} from './query/EntryReferences.js'
import {resolveEntryQuery} from './query/ResolveQuery.js'
import {
  createSearch,
  rebuildSearch,
  type SearchQuery,
  fuzzyDistance,
  searchQuery,
  searchTokens,
  SearchVocabulary,
  updateSearch
} from './query/Search.js'
import {
  EntrySyncer,
  EntrySyncRoot,
  type EntrySyncTarget
} from './sync/EntrySyncer.js'

/** Above this many changed entries a full rebuild beats updating in place. */
const searchRebuildThreshold = 2000
/** Temporary table holding the source payloads while a reindex runs. */
const reindexBlobsName = 'alinea_reindex_blobs'

/** Shared, connection-scoped state of one queryable layer of the entry index. */
export interface EntryLayerContext {
  nextOverlayId: number
  queue: TaskQueue
  syncer: EntrySyncer
}

export interface EntryLayerState {
  /** Read connection, or the write transaction of a working layer. */
  db: Database
  /** Connection used to synchronize and apply, usually the read connection. */
  syncDb: Database
  syncer: EntrySyncer
  context: EntryLayerContext
  target: EntrySyncTarget
  /** The copy-on-write table behind an overlay's target. */
  view?: EntryView
  /** The layer an overlay was created from. */
  parent?: EntryLayer
  tree?: ReadonlyTree
  initialTree?: ReadonlyTree
  searchName: string
  /** The search table this layer rebuilds into once its contents diverge. */
  ownSearchName?: string
  /** Whether the search table needs a full rebuild; unknown until the stored
   * search revision is compared with the database revision. */
  searchDirty: boolean | 'unknown'
  /** The connection is already inside a transaction: never open nested ones. */
  transactional: boolean
}

interface StoredState {
  revision: string
  tree: Tree | null
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
  database: EntryOverlay
  source: OverlaySource
  close(): Promise<void>
}

/** One queryable layer of the entry index: a database or a view over one. */
export abstract class EntryLayer extends Graph implements AsyncDisposable {
  #config: Config
  #options: EntryDatabaseOptions
  #db: Database
  #syncDb: Database
  #syncer: EntrySyncer
  #context: EntryLayerContext
  #target: EntrySyncTarget
  #view?: EntryView
  #parent?: EntryLayer
  #tree?: ReadonlyTree
  #initialTree?: ReadonlyTree
  #searchName: string
  #ownSearchName?: string
  #searchDirty: boolean | 'unknown'
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
    this.#syncDb = state.syncDb
    this.#syncer = state.syncer
    this.#context = state.context
    this.#target = state.target
    this.#view = state.view
    this.#parent = state.parent
    this.#tree = state.tree
    this.#initialTree = state.initialTree
    this.#searchName = state.searchName
    this.#ownSearchName = state.ownSearchName
    this.#searchDirty = state.searchDirty
    this.#transactional = state.transactional
  }

  /** Where reads go: the parent's table while the overlay is unwritten. */
  get #readTarget(): EntryIndexTarget {
    return this.#view?.readTarget ?? this.#target.entries
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

  /** Synchronize a source through this layer's single prepared syncer. */
  async syncWith(
    source: RemoteSource,
    options?: SyncOptions
  ): Promise<EntrySyncResult> {
    this.#assertOpen()
    const validate = options?.validate ?? true
    return this.#syncQueue.run(async () => {
      const current = await this.#onSyncConnection(async () => {
        await this.#resolveSearchState(this.#syncDb)
        return this.#getRevision(this.#syncDb)
      })
      const tree = await source.getTreeIfDifferent(current)
      if (!tree) return {revision: current, changedEntryIds: []}
      const changedEntryIds = await this.#syncSource(
        source,
        tree,
        current,
        validate
      )
      return {revision: tree.sha, changedEntryIds}
    })
  }

  /**
   * Adopt another config and derive every entry again from the payloads this
   * layer stores. The rows of the previous config are replaced within one
   * transaction, so reads keep answering from them until the replacement is
   * committed. Only a root
   * layer without overlays can be reindexed.
   */
  protected async reindexEntries(
    config: Config,
    reset?: (tx: Database) => Promise<void>
  ): Promise<EntrySyncResult> {
    this.#assertOpen()
    if (this.#ownSearchName)
      throw new Error('Cannot reindex an overlay, reindex its base instead')
    if (this.#children.size)
      throw new Error('Cannot reindex an entry database with active overlays')
    return this.#syncQueue.run(async () => {
      this.#config = config
      await this.#syncer.reconfigure(config)
      if (this.#context.syncer !== this.#syncer)
        await this.#context.syncer.reconfigure(config)
      const state = this.#target.state
      const entries = this.#target.entries
      const blobs = sql.identifier(reindexBlobsName)
      const encoder = new TextEncoder()
      const result = await this.#onSyncConnection(async () => {
        // Read outside the transaction: queries on the connection itself would
        // wait for the transaction to finish.
        const {tree} = await this.#readTreeState()
        if (!tree)
          throw new Error('Cannot reindex a database without a source tree')
        return this.#syncDb.transaction(
          async tx => {
            // The stored payloads are the exact source files of the recorded
            // tree, so they feed the sync back in without an external source.
            await tx.run(sql`drop table if exists temp.${blobs}`)
            await tx.run(sql`create temp table ${blobs} as
              select ${entries.fileHash} as sha,
                coalesce(${entries.payload}, ${entryDataText(entries)}) as blob
              from ${entries}`)
            await tx.delete(entries)
            await tx
              .update(state)
              .set({
                revision: ReadonlyTree.EMPTY.sha,
                tree: ReadonlyTree.EMPTY,
                searchRevision: null
              })
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
      // Searchable text depends on the config: build the index again on the
      // next search instead of updating rows in place.
      this.#searchDirty = true
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
    return this.#syncQueue.run(() => this.#applyMutations(mutations, options))
  }

  async #applyMutations(
    mutations: ReadonlyArray<Mutation>,
    options: EntryApplyOptions
  ): Promise<EntryApplyResult> {
    const from = await options.source.getTree()
    const view = this.#view
    if (view) await this.#onSyncConnection(() => view.diverge())
    const applied = await this.#syncDb.transaction(
      async tx => {
        const revision = await this.#getRevision(tx)
        if (revision !== from.sha)
          throw new ShaMismatchError(revision, from.sha)
        await this.#resolveSearchState(tx)
        const workingSource = new OverlaySource(options.source, from)
        const workingLayer = new EntryWorkingLayer(
          this.#config,
          this.#options,
          {
            db: tx,
            syncDb: tx,
            syncer: this.#syncer,
            context: {
              nextOverlayId: this.#context.nextOverlayId,
              queue: new TaskQueue(),
              syncer: this.#syncer
            },
            target: this.#target,
            tree: from,
            searchName: this.#searchName,
            searchDirty: this.#searchDirty,
            transactional: true
          }
        )
        const transaction = new EntryTransaction(
          workingLayer,
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
    await this.#onSyncConnection(() =>
      this.#refreshSearch(this.#syncDb, applied.result.changedEntryIds)
    )
    this.#emitChange(applied.result)
    return applied.result
  }

  async close(): Promise<void> {
    if (this.#closed) return
    if (this.#children.size)
      throw new Error('Cannot close an entry database with active overlays')
    this.#closed = true
    await this.#syncQueue.drain()
    await this.#withReadConnection(async () => {
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
    return this.#withReadConnection(() => this.#getRevision(this.#db))
  }

  async getTree(): Promise<ReadonlyTree> {
    const state = await this.#withReadConnection(() => this.#readTreeState())
    if (!state.tree)
      throw new Error(`Database revision ${state.revision} has no source tree`)
    return state.tree
  }

  async #readTreeState() {
    if (this.#tree) {
      const revision = await this.#getRevision(this.#db)
      if (this.#tree.sha === revision) return {revision, tree: this.#tree}
    }
    const state = await this.#getState(this.#db)
    this.#tree = state.tree ? new ReadonlyTree(state.tree) : undefined
    return {revision: state.revision, tree: this.#tree}
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
      const target = this.#readTarget
      const rows = await this.#withReadConnection(async () =>
        this.#db
          .select({
            sha: target.fileHash,
            payload: sql<string>`coalesce(${target.payload}, ${entryDataText(target)})`
          })
          .from(target)
          .where(inArray(target.fileHash, requested))
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

  async #getState(db: Database): Promise<StoredState> {
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
    fromRevision: string,
    validate: boolean
  ): Promise<Array<string>> {
    this.#initialTree ??= tree
    let changedEntryIds = Array<string>()
    const sync = async () => {
      await this.#view?.diverge()
      changedEntryIds = await this.#syncer.sync(
        this.#target,
        source,
        tree,
        fromRevision,
        {
          previousTree: this.#tree,
          withinTransaction: this.#transactional,
          validate
        }
      )
      this.#tree = tree
      await this.#refreshSearch(this.#syncDb, changedEntryIds)
    }
    await this.#onSyncConnection(sync)
    this.#emitChange({revision: tree.sha, changedEntryIds})
    return changedEntryIds
  }

  /**
   * Keep the search table in step with changed entries. A layer sharing its
   * parent's table diverts to its own on the first change and builds that on
   * demand; a built table is updated in place, which is far cheaper than
   * tokenizing every entry again after each sync.
   */
  async #refreshSearch(
    db: Database,
    changedEntryIds: ReadonlyArray<string>
  ): Promise<void> {
    if (!changedEntryIds.length) return
    if (this.#ownSearchName && this.#searchName !== this.#ownSearchName) {
      this.#searchName = this.#ownSearchName
      this.#searchDirty = true
      return
    }
    if (this.#searchDirty !== false) {
      this.#searchDirty = true
      return
    }
    if (changedEntryIds.length > searchRebuildThreshold) {
      this.#searchDirty = true
      return
    }
    await updateSearch(db, this.#readTarget, this.#searchName, changedEntryIds)
    await this.#recordSearchRevision(db)
  }

  /** Trust a persisted search table when it was updated for this revision. */
  async #resolveSearchState(db: Database): Promise<void> {
    if (this.#searchDirty !== 'unknown') return
    const state = this.#target.state
    const row = await db
      .select({revision: state.revision, searchRevision: state.searchRevision})
      .from(state)
      .where(eq(state.id, 1))
      .get()
    this.#searchDirty = !row || row.searchRevision !== row.revision
  }

  async #recordSearchRevision(db: Database): Promise<void> {
    const state = this.#target.state
    await db
      .update(state)
      .set({searchRevision: sql<string>`${state.revision}`})
      .where(eq(state.id, 1))
  }

  #emitChange(change: EntrySyncResult): void {
    for (const listener of this.#changeListeners) listener(change)
  }

  async prepareSearch(): Promise<void> {
    await this.#withReadConnection(() => this.#ensureSearch(this.#db))
  }

  #withReadConnection<T>(run: () => Promise<T>): Promise<T> {
    return this.#context.queue.run(run)
  }

  /** Serialize with the read connection only when both share one connection. */
  #onSyncConnection<T>(run: () => Promise<T>): Promise<T> {
    return this.#syncDb === this.#db ? this.#withReadConnection(run) : run()
  }

  /** Run a task serialized with every other read on this connection. */
  protected withReadConnection<T>(run: () => Promise<T>): Promise<T> {
    return this.#withReadConnection(run)
  }

  /** Create and synchronize a copy-on-write layer over this one. */
  async overlay(source: RemoteSource): Promise<EntryOverlay> {
    this.#assertOpen()
    const name = `overlay_${this.#context.nextOverlayId++}`
    let child: EntryOverlay | undefined
    try {
      const {revision, tree} = await this.#withReadConnection(async () => {
        await this.#resolveSearchState(this.#db)
        return this.#readTreeState()
      })
      const view = await this.#withReadConnection(() =>
        EntryView.create(this.#db, name, this.#target.entries, revision)
      )
      child = new EntryOverlay(this.#config, this.#options, {
        db: this.#db,
        syncDb: this.#db,
        syncer: this.#context.syncer,
        context: this.#context,
        target: {entries: view.entries, state: view.state},
        tree,
        initialTree: this.#initialTree,
        searchName: this.#searchDirty ? view.searchName : this.#searchName,
        ownSearchName: view.searchName,
        searchDirty: this.#searchDirty,
        transactional: false,
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
    return this.#withReadConnection(() => {
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
      entries: this.#readTarget,
      searchName: this.#searchName,
      search:
        this.#options.search ?? (input => this.#searchPlan(database, input)),
      prepareSearch: () => this.#ensureSearch(database),
      includedAtBuild: filePath =>
        this.#options.includedAtBuild?.(filePath) ?? false
    })
  }

  /** Scan references in bounded pages without retaining an entry index. */
  async referencesTo(
    query: EntryReferenceQuery
  ): Promise<EntryReferenceResult> {
    this.#assertOpen()
    return this.#withReadConnection(() =>
      this.#db.transaction(
        tx => queryEntryReferences(this.#config, tx, this.#readTarget, query),
        {
          async: true,
          behavior: 'deferred'
        }
      )
    )
  }

  /**
   * Prepare the index and its vocabulary, then plan a search whose tokens
   * also match indexed terms within a small edit distance.
   */
  async #searchPlan(
    db: Database,
    input: GraphQuery['search']
  ): Promise<SearchQuery | undefined> {
    const entry = this.#readTarget
    const tokens = searchTokens(input)
    if (!tokens) return undefined
    await this.#ensureSearch(db)
    // Short tokens only match as prefixes; the vocabulary stays unloaded.
    if (!tokens.some(token => fuzzyDistance(token) > 0))
      return searchQuery(input, entry, this.#searchName)
    const own = this.#searchName === this.#ownSearchName
    const state = own ? this.#target.state : EntrySyncRoot.state
    const row = await db
      .select({searchRevision: state.searchRevision})
      .from(state)
      .where(eq(state.id, 1))
      .get()
    await this.#vocabulary.load(
      db,
      this.#searchName,
      own ? 'temp' : 'main',
      row?.searchRevision ?? ''
    )
    return searchQuery(input, entry, this.#searchName, {
      alternatives: token => this.#vocabulary.alternatives(token)
    })
  }

  async #ensureSearch(db: Database): Promise<void> {
    await this.#resolveSearchState(db)
    if (!this.#searchDirty) return
    if (this.#ownSearchName) await createSearch(db, this.#searchName, true)
    await rebuildSearch(db, this.#readTarget, this.#searchName)
    this.#searchDirty = false
    await this.#recordSearchRevision(db)
  }

  onChange(listener: EntryChangeListener): () => void {
    this.#assertOpen()
    this.#changeListeners.add(listener)
    return () => this.#changeListeners.delete(listener)
  }
}

/** A named copy-on-write layer over the layer it was created from. */
export class EntryOverlay extends EntryLayer {}

/** The working copy of a layer inside its own write transaction. */
class EntryWorkingLayer extends EntryLayer {}
