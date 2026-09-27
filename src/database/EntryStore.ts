import type {Config} from '#/core/Config.js'
import type {
  GetBlobsOptions,
  RemoteSource,
  Source
} from '#/core/source/Source.js'
import {applyChangesFrom} from '#/core/source/Source.js'
import {OverlaySource} from '#/core/source/OverlaySource.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import type {Entry} from '#/core/Entry.js'
import type {AnyQueryResult, GraphQuery} from '#/core/Graph.js'
import {createRecord} from '#/core/EntryRecord.js'
import {seedMutations} from '#/core/EntrySeed.js'
import {TaskQueue} from '#/core/util/Async.js'
import type {Mutation} from '#/core/db/Mutation.js'
import type {Policy} from '#/core/Role.js'
import type {
  EntryReferenceQuery,
  EntryReferenceResult
} from '#/core/db/EntryReference.js'
import {sourceChanges, type CommitRequest} from '#/core/db/CommitRequest.js'
import type {LocalStore, SyncOptions} from '#/core/db/LocalStore.js'
import {WriteableGraph} from '#/core/db/WriteableGraph.js'
import type {UploadMetadata, UploadResponse} from '#/core/Connection.js'
import {ShaMismatchError} from '#/core/source/ShaMismatchError.js'
import {EntryDatabase, type EntryChangeListener} from './EntryDatabase.js'
import {openWasmDatabase} from './driver/WasmDatabase.js'
import {DatabaseSource} from './DatabaseSource.js'

interface PreviewOverlay {
  database: EntryDatabase
  /** The store revision, source tree and entry payload the overlay shows. */
  applied: string
}

export interface EntryStoreOptions {
  ownsDatabase?: boolean
  sourceFollowsDatabase?: boolean
}

/** Source and commit lifecycle around the transport-neutral SQLite database. */
export class EntryStore
  extends WriteableGraph
  implements LocalStore, AsyncDisposable
{
  /** Replaced only by a reindex, which derives every entry again. */
  config: Config
  readonly database: EntryDatabase
  readonly source: Source
  #ownsDatabase: boolean
  #sourceFollowsDatabase: boolean
  #queue = new TaskQueue()
  /** Serializes preview queries: each switches the overlay, then reads it. */
  #previewQueue = new TaskQueue()
  #preview?: PreviewOverlay

  constructor(
    config: Config,
    database: EntryDatabase,
    source: Source,
    options: EntryStoreOptions = {}
  ) {
    super()
    this.config = config
    this.database = database
    this.source = source
    this.#ownsDatabase = options.ownsDatabase ?? false
    this.#sourceFollowsDatabase = options.sourceFollowsDatabase ?? false
  }

  static async memory(config: Config, source: Source): Promise<EntryStore> {
    const {database: db, fork} = await openWasmDatabase()
    try {
      await EntryDatabase.createSchema(db, ReadonlyTree.EMPTY.sha)
      const database = new EntryDatabase(config, db, {fork})
      return new EntryStore(config, database, source, {ownsDatabase: true})
    } catch (error) {
      await db.close()
      throw error
    }
  }

  get sha(): Promise<string> {
    return this.database.getRevision()
  }

  includedAtBuild(filePath: string): boolean | Promise<boolean> {
    return this.database.includedAtBuild(filePath)
  }

  /**
   * Preview queries resolve over the store with the previewed entry synced
   * in. The last payload keeps its fork, so repeated queries of one preview
   * sync once; another payload or store revision forks afresh. A database
   * that cannot fork syncs each preview in a transaction it rolls back.
   */
  resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    const {preview, ...withoutPreview} = query
    if (!preview || !('entry' in preview)) return this.database.resolve(query)
    return this.#previewQueue.run(() =>
      this.#resolvePreview(preview.entry, withoutPreview as Query)
    )
  }

  /** Resolve with the entry's record at its file path. */
  async #resolvePreview<Query extends GraphQuery>(
    entry: Entry,
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    const contents = JSON.stringify(createRecord(entry, entry.status), null, 2)
    const revision = await this.database.getRevision()
    const tree = await this.source.getTree()
    const applied = JSON.stringify([
      revision,
      tree.sha,
      entry.filePath,
      entry.fileHash,
      contents
    ])
    if (this.#preview?.applied === applied)
      return this.#preview.database.resolve(query)
    const source = new OverlaySource(this.source, tree)
    await source.applyChanges({
      fromSha: tree.sha,
      changes: [
        {
          op: 'add',
          path: entry.filePath,
          sha: entry.fileHash,
          contents: new TextEncoder().encode(contents)
        }
      ]
    })
    // An unchanged record previews the store itself.
    if ((await source.getTree()).sha === revision)
      return this.database.resolve(query)
    const changes = await changesSince(source, await this.database.getTree())
    if (!this.database.forkable)
      return this.database.resolveWith(changes, query)
    await this.#closePreview()
    const database = await this.database.overlay(changes)
    this.#preview = {database, applied}
    return database.resolve(query)
  }

  async #closePreview(): Promise<void> {
    const preview = this.#preview
    this.#preview = undefined
    await preview?.database.close()
  }

  referencesTo(query: EntryReferenceQuery): Promise<EntryReferenceResult> {
    return this.database.referencesTo(query)
  }

  onChange(listener: EntryChangeListener): () => void {
    return this.database.onChange(listener)
  }

  sync(): Promise<string> {
    return this.#queue.run(() => this.#sync())
  }

  async #sync(): Promise<string> {
    await this.database.syncWith(this.source)
    await this.#seed()
    return this.database.getRevision()
  }

  async #seed(): Promise<void> {
    const mutations = await seedMutations(this.database, this.config)
    if (!mutations.length) return
    const result = await this.database.apply(mutations, {source: this.source})
    await this.#commitToSource(result.request)
  }

  /** Mirror a committed request into the source unless it trails the database. */
  async #commitToSource(request: CommitRequest): Promise<void> {
    if (this.#sourceFollowsDatabase) return
    await this.source.applyChanges(sourceChanges(request))
  }

  /** Keep the writable source and its query database at one remote revision. */
  syncWith(remote: RemoteSource, options?: SyncOptions): Promise<string> {
    return this.#queue.run(async () => {
      if (this.#sourceFollowsDatabase) {
        await this.database.syncWith(remote, options)
        await this.#seed()
        return this.database.getRevision()
      }
      const localTree = await this.source.getTree()
      const remoteTree = await remote.getTreeIfDifferent(localTree.sha)
      if (!remoteTree) return this.#sync()
      const batch = localTree.diff(remoteTree)
      const knownRemote = sourceAtTree(remote, remoteTree)
      await this.database.syncWith(knownRemote, options)
      await applyChangesFrom(
        this.source,
        new DatabaseSource(this.database),
        batch,
        remoteTree
      )
      await this.#seed()
      return this.database.getRevision()
    })
  }

  /** Plan a commit without changing this store. */
  request(
    mutations: ReadonlyArray<Mutation>,
    policy?: Policy
  ): Promise<CommitRequest> {
    return this.#queue.run(async () => {
      await this.#sync()
      return this.database.plan(mutations, {source: this.source, policy})
    })
  }

  mutate(mutations: Array<Mutation>): Promise<{sha: string}> {
    return this.#queue.run(async () => {
      await this.#sync()
      const result = await this.database.apply(mutations, {source: this.source})
      await this.#commitToSource(result.request)
      return {sha: result.revision}
    })
  }

  write(request: CommitRequest): Promise<{sha: string}> {
    return this.#queue.run(async () => {
      const tree = await this.source.getTree()
      if (this.#sourceFollowsDatabase) {
        if (tree.sha === request.intoSha) return {sha: tree.sha}
        if (tree.sha !== request.fromSha)
          throw new ShaMismatchError(request.fromSha, tree.sha)
        const source = await OverlaySource.create(this.source)
        await source.applyChanges(sourceChanges(request))
        const result = await this.database.syncWith(source)
        return {sha: result.revision}
      }
      if (tree.sha !== request.intoSha)
        await this.source.applyChanges(sourceChanges(request))
      const result = await this.database.syncWith(this.source)
      return {sha: result.revision}
    })
  }

  getTreeIfDifferent(sha: string): Promise<ReadonlyTree | undefined> {
    return this.source.getTreeIfDifferent(sha)
  }

  getBlobs(shas: ReadonlyArray<string>, options?: GetBlobsOptions) {
    return this.source.getBlobs(shas, options)
  }

  prepareUpload(
    _file: string,
    _metadata?: UploadMetadata
  ): Promise<UploadResponse> {
    return Promise.reject(new Error('Uploads not supported on this store'))
  }

  /** Whether the underlying database was closed. */
  get closed(): boolean {
    return this.database.closed
  }

  async close(): Promise<void> {
    await this.#queue.drain()
    await this.#previewQueue.run(() => this.#closePreview())
    if (this.#ownsDatabase) await this.database.close()
  }

  [Symbol.asyncDispose](): Promise<void> {
    return this.close()
  }
}

/**
 * The source at its current tree, holding every file changed since `from`.
 * A preview synchronizes on the connection the store's own source may read
 * blobs from, so the changed files are fetched before a sync starts.
 */
async function changesSince(
  source: OverlaySource,
  from: ReadonlyTree
): Promise<OverlaySource> {
  const tree = await source.getTree()
  const changes = new OverlaySource(source, from)
  await changes.applyChangesFrom(source, from.diff(tree), tree)
  return changes
}

/** Pin the tree while streaming blobs from the revision already fetched. */
function sourceAtTree(source: RemoteSource, tree: ReadonlyTree): RemoteSource {
  return {
    async getTreeIfDifferent(revision) {
      return revision === tree.sha ? undefined : tree
    },
    getBlobs(shas, options) {
      return source.getBlobs(shas, options)
    }
  }
}
