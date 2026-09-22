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
import {TaskQueue} from '#/core/util/Async.js'
import {eq, inArray, sql, type Database} from 'rado'
import {DatabaseSource} from './DatabaseSource.js'
import {EntryView} from './entry/EntryView.js'
import type {EntryIndexTarget} from './entry/EntryTable.js'
import {EntryTransaction} from './EntryTransaction.js'
import {queryEntryReferences} from './query/EntryReferences.js'
import {resolveEntryQuery} from './query/ResolveQuery.js'
import {createSearch, rebuildSearch, type SearchQuery} from './query/Search.js'
import {EntrySyncer, type EntrySyncTarget} from './sync/EntrySyncer.js'

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
  tree?: ReadonlyTree
  initialTree?: ReadonlyTree
  searchName: string
  /** The search table this layer rebuilds into once its contents diverge. */
  ownSearchName?: string
  searchDirty: boolean
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
  #entryTarget: EntryIndexTarget
  #tree?: ReadonlyTree
  #initialTree?: ReadonlyTree
  #searchName: string
  #ownSearchName?: string
  #searchDirty: boolean
  #transactional: boolean
  #children = new Set<EntryLayer>()
  #changeListeners = new Set<EntryChangeListener>()
  #syncQueue = new TaskQueue()
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
    this.#entryTarget = state.target.entries
    this.#tree = state.tree
    this.#initialTree = state.initialTree
    this.#searchName = state.searchName
    this.#ownSearchName = state.ownSearchName
    this.#searchDirty = state.searchDirty
    this.#transactional = state.transactional
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
      const current = await this.#onSyncConnection(() =>
        this.#getRevision(this.#syncDb)
      )
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
    const applied = await this.#syncDb.transaction(
      async tx => {
        const revision = await this.#getRevision(tx)
        if (revision !== from.sha)
          throw new ShaMismatchError(revision, from.sha)
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
    this.#markChanged(applied.result.changedEntryIds)
    this.#emitChange(applied.result)
    return applied.result
  }

  async close(): Promise<void> {
    if (this.#closed) return
    if (this.#children.size)
      throw new Error('Cannot close an entry database with active overlays')
    this.#closed = true
    await this.#syncQueue.drain()
    await this.#withReadConnection(() => this.releaseLayer())
  }

  /** Release what this layer owns, serialized with the read connection. */
  protected abstract releaseLayer(): Promise<void>

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
      // Synced blobs already live in the overlay. Avoid scanning the immutable
      // base for those hashes, which have no lookup index in generated files.
      const targets = this.#target.changes
        ? [this.#target.changes, this.#entryTarget]
        : [this.#entryTarget]
      for (const target of targets) {
        const remaining = requested.filter(sha => !found.has(sha))
        if (!remaining.length) break
        const rows = await this.#withReadConnection(async () =>
          this.#db
            .select({
              sha: target.fileHash,
              payload: sql<string>`coalesce(${target.payload}, ${target.data})`
            })
            .from(target)
            .where(inArray(target.fileHash, remaining))
            .all()
        )
        for (const row of rows) {
          if (found.has(row.sha)) continue
          found.add(row.sha)
          yield [row.sha, encoder.encode(row.payload)]
        }
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
      this.#markChanged(changedEntryIds)
    }
    await this.#onSyncConnection(sync)
    this.#emitChange({revision: tree.sha, changedEntryIds})
    return changedEntryIds
  }

  /** Divert to this layer's own search table once its contents diverge. */
  #markChanged(changedEntryIds: ReadonlyArray<string>): void {
    if (!changedEntryIds.length) return
    if (this.#ownSearchName) this.#searchName = this.#ownSearchName
    this.#searchDirty = true
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
      const {revision, tree} = await this.#withReadConnection(() =>
        this.#readTreeState()
      )
      const view = await this.#withReadConnection(() =>
        EntryView.create(this.#db, name, this.#entryTarget, revision)
      )
      child = new EntryOverlay(
        this.#config,
        this.#options,
        {
          db: this.#db,
          syncDb: this.#db,
          syncer: this.#context.syncer,
          context: this.#context,
          target: {
            name,
            entries: view.entries,
            changes: view.changes,
            state: view.state
          },
          tree,
          initialTree: this.#initialTree,
          searchName: this.#searchDirty ? view.searchName : this.#searchName,
          ownSearchName: view.searchName,
          searchDirty: this.#searchDirty,
          transactional: false
        },
        view,
        () => {
          if (child) this.#children.delete(child)
        }
      )
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
      entries: this.#entryTarget,
      searchName: this.#searchName,
      search: this.#options.search,
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
        tx => queryEntryReferences(this.#config, tx, this.#entryTarget, query),
        {
          async: true,
          behavior: 'deferred'
        }
      )
    )
  }

  async #ensureSearch(db: Database): Promise<void> {
    if (!this.#searchDirty) return
    if (this.#ownSearchName) await createSearch(db, this.#searchName, true)
    await rebuildSearch(db, this.#entryTarget, this.#searchName)
    this.#searchDirty = false
  }

  onChange(listener: EntryChangeListener): () => void {
    this.#assertOpen()
    this.#changeListeners.add(listener)
    return () => this.#changeListeners.delete(listener)
  }
}

/** A named copy-on-write view over the layer it was created from. */
export class EntryOverlay extends EntryLayer {
  #view: EntryView
  #syncer: EntrySyncer
  #target: EntrySyncTarget
  #detach: () => void

  /** @internal Constructed by EntryLayer.overlay. */
  constructor(
    config: Config,
    options: EntryDatabaseOptions,
    state: EntryLayerState,
    view: EntryView,
    detach: () => void
  ) {
    super(config, options, state)
    this.#view = view
    this.#syncer = state.context.syncer
    this.#target = state.target
    this.#detach = detach
  }

  protected async releaseLayer(): Promise<void> {
    await this.#syncer.release(this.#target)
    await this.#view.close()
    this.#detach()
  }
}

/** The working copy of a layer inside its own write transaction. */
class EntryWorkingLayer extends EntryLayer {
  protected releaseLayer(): Promise<void> {
    return Promise.resolve()
  }
}
