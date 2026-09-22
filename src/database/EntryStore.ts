import type {Config} from '#/core/Config.js'
import type {
  GetBlobsOptions,
  RemoteSource,
  Source
} from '#/core/source/Source.js'
import {applyChangesFrom} from '#/core/source/Source.js'
import {OverlaySource} from '#/core/source/OverlaySource.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
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
import {EntryDatabase} from './EntryDatabase.js'
import type {
  EntryChangeListener,
  EntryDatabaseOptions,
  EntryLayer,
  EntryOverlay
} from './EntryLayer.js'
import {wasmDatabase} from './driver/WasmDatabase.js'
import {DatabaseSource} from './DatabaseSource.js'

export interface EntryStoreOptions {
  ownsDatabase?: boolean
  sourceFollowsDatabase?: boolean
  close?: () => Promise<void>
}

/** Source and commit lifecycle around the transport-neutral SQLite database. */
export class EntryStore
  extends WriteableGraph
  implements LocalStore, AsyncDisposable
{
  /** Replaced only by a reindex, which derives every entry again. */
  config: Config
  readonly database: EntryLayer
  readonly source: Source
  #ownsDatabase: boolean
  #sourceFollowsDatabase: boolean
  #close?: () => Promise<void>
  #queue = new TaskQueue()

  constructor(
    config: Config,
    database: EntryLayer,
    source: Source,
    options: EntryStoreOptions = {}
  ) {
    super()
    this.config = config
    this.database = database
    this.source = source
    this.#ownsDatabase = options.ownsDatabase ?? false
    this.#sourceFollowsDatabase = options.sourceFollowsDatabase ?? false
    this.#close = options.close
  }

  static async memory(
    config: Config,
    source: Source,
    options: EntryDatabaseOptions = {}
  ): Promise<EntryStore> {
    const db = await wasmDatabase()
    try {
      await EntryDatabase.createSchema(db, ReadonlyTree.EMPTY.sha)
      const database = new EntryDatabase(config, db, options)
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

  resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    if (query.preview && 'entry' in query.preview)
      return this.#resolvePreview(query)
    return this.database.resolve(query)
  }

  async #resolvePreview<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    const preview = query.preview
    if (!preview || !('entry' in preview)) return this.database.resolve(query)
    const entry = preview.entry
    return this.#withOverlay(
      async source => {
        const tree = await source.getTree()
        await source.applyChanges({
          fromSha: tree.sha,
          changes: [
            {
              op: 'add',
              path: entry.filePath,
              sha: entry.fileHash,
              contents: new TextEncoder().encode(
                JSON.stringify(createRecord(entry, entry.status), null, 2)
              )
            }
          ]
        })
      },
      database => {
        const {preview: _preview, ...withoutPreview} = query
        return database.resolve(withoutPreview as Query)
      }
    )
  }

  /** Run against a throwaway overlay of this store, prepared before it syncs. */
  async #withOverlay<T>(
    prepare: ((source: OverlaySource) => Promise<void>) | undefined,
    run: (database: EntryOverlay, source: OverlaySource) => Promise<T>
  ): Promise<T> {
    const source = await OverlaySource.create(this.source)
    await prepare?.(source)
    const database = await this.database.overlay(source)
    try {
      return await run(database, source)
    } finally {
      await database.close()
    }
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

  /** Create a persistent copy-on-write session over this store. */
  overlay(remote: RemoteSource): Promise<EntryStore> {
    return this.#queue.run(async () => {
      const source = await OverlaySource.create(this.source)
      const localTree = await source.getTree()
      const remoteTree = await remote.getTreeIfDifferent(localTree.sha)
      if (remoteTree) {
        const knownRemote = sourceAtTree(remote, remoteTree)
        const database = await this.database.overlay(knownRemote)
        try {
          await source.applyChangesFrom(
            new DatabaseSource(database),
            localTree.diff(remoteTree),
            remoteTree
          )
          return new EntryStore(this.config, database, source, {
            ownsDatabase: true
          })
        } catch (error) {
          await database.close()
          throw error
        }
      }
      const database = await this.database.overlay(source)
      return new EntryStore(this.config, database, source, {
        ownsDatabase: true
      })
    })
  }

  /** Plan a commit without changing this store. */
  request(
    mutations: ReadonlyArray<Mutation>,
    policy?: Policy
  ): Promise<CommitRequest> {
    return this.#queue.run(async () => {
      await this.#sync()
      return this.#withOverlay(
        undefined,
        async (database, source) =>
          (await database.apply(mutations, {source, policy})).request
      )
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
    if (this.#close) await this.#close()
    else if (this.#ownsDatabase) await this.database.close()
  }

  [Symbol.asyncDispose](): Promise<void> {
    return this.close()
  }
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
