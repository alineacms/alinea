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
import {Entry} from '#/core/Entry.js'
import {entrySeeds} from '#/core/EntrySeed.js'
import {createId} from '#/core/Id.js'
import {assert} from '#/core/util/Assert.js'
import type {Mutation} from '#/core/db/Mutation.js'
import type {Policy} from '#/core/Role.js'
import type {
  EntryReferenceQuery,
  EntryReferenceResult
} from '#/core/db/EntryReference.js'
import {sourceChanges, type CommitRequest} from '#/core/db/CommitRequest.js'
import {WriteableGraph} from '#/core/db/WriteableGraph.js'
import type {UploadMetadata, UploadResponse} from '#/core/Connection.js'
import {
  EntryDatabase,
  type EntryChangeListener,
  type EntryDatabaseOptions,
  type EntrySyncResult
} from './EntryDatabase.js'
import {wasmDatabase} from './driver/WasmDatabase.js'
import {DatabaseSource} from './DatabaseSource.js'

/** Source and commit lifecycle around the transport-neutral SQLite database. */
export class EntryStore extends WriteableGraph implements AsyncDisposable {
  readonly config: Config
  readonly database: EntryDatabase
  readonly source: Source
  #ownsDatabase: boolean
  #close?: () => Promise<void>
  #queue: Promise<unknown> = Promise.resolve()

  constructor(
    config: Config,
    database: EntryDatabase,
    source: Source,
    options: {ownsDatabase?: boolean; close?: () => Promise<void>} = {}
  ) {
    super()
    this.config = config
    this.database = database
    this.source = source
    this.#ownsDatabase = options.ownsDatabase ?? false
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
      const store = new EntryStore(config, database, source, {
        ownsDatabase: true
      })
      return store
    } catch (error) {
      await db.close()
      throw error
    }
  }

  get sha(): Promise<string> {
    return this.database.getRevision()
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
    const source = await OverlaySource.create(this.source)
    const tree = await source.getTree()
    const entry = preview.entry
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
    const database = await this.database.overlay(source)
    try {
      const {preview: _preview, ...withoutPreview} = query
      return database.resolve(withoutPreview as Query)
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

  async sync(): Promise<string> {
    return this.#run(() => this.#sync())
  }

  async #sync(): Promise<string> {
    await this.database.syncWith(this.source)
    await this.#seed()
    return this.database.getRevision()
  }

  #run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.#queue.then(task)
    this.#queue = result.catch(() => {})
    return result
  }

  async #seed(): Promise<void> {
    const seeds = entrySeeds(this.config)
    if (!seeds.length) return
    const nodeIds = new Map<string, string>()
    const translationIds = new Map<string, string>()
    const mutations = Array<Mutation>()
    for (const seed of seeds) {
      const existing = await this.database.first({
        filePath: {
          in: [
            seed.filePath,
            seed.filePath.replace(/\.json$/, '.draft.json'),
            seed.filePath.replace(/\.json$/, '.archived.json')
          ]
        },
        status: 'all',
        select: {id: Entry.id, type: Entry.type}
      })
      if (existing) {
        assert(existing.type === seed.type, `Type mismatch in ${seed.nodePath}`)
        nodeIds.set(seed.nodePath, existing.id)
        translationIds.set(`${seed.workspace}/${seed.id}`, existing.id)
        continue
      }
      const translationKey = `${seed.workspace}/${seed.id}`
      const id = translationIds.get(translationKey) ?? createId()
      const parentId = seed.parentNodePath
        ? nodeIds.get(seed.parentNodePath)
        : null
      if (seed.parentNodePath)
        assert(parentId, `Missing seed parent ${seed.parentNodePath}`)
      translationIds.set(translationKey, id)
      nodeIds.set(seed.nodePath, id)
      mutations.push({
        op: 'create',
        id,
        parentId,
        locale: seed.locale,
        type: seed.type,
        workspace: seed.workspace,
        root: seed.root,
        fromSeed: seed.seedPath,
        data: {path: seed.data.path}
      })
    }
    if (!mutations.length) return
    const result = await this.database.apply(mutations, {source: this.source})
    await this.source.applyChanges(sourceChanges(result.request))
  }

  /** Keep the writable source and its query database at one remote revision. */
  syncWith(remote: RemoteSource): Promise<string> {
    return this.#run(async () => {
      const localTree = await this.source.getTree()
      const remoteTree = await remote.getTreeIfDifferent(localTree.sha)
      if (!remoteTree) return this.#sync()
      const batch = localTree.diff(remoteTree)
      const knownRemote: RemoteSource = {
        async getTreeIfDifferent(revision) {
          return revision === remoteTree.sha ? undefined : remoteTree
        },
        async *getBlobs(shas, options) {
          yield* remote.getBlobs(shas, options)
        }
      }
      await this.database.syncWith(knownRemote)
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
    return this.#run(async () => {
      const source = await OverlaySource.create(this.source)
      const localTree = await source.getTree()
      const remoteTree = await remote.getTreeIfDifferent(localTree.sha)
      if (remoteTree) {
        const knownRemote: RemoteSource = {
          async getTreeIfDifferent(revision) {
            return revision === remoteTree.sha ? undefined : remoteTree
          },
          getBlobs(shas, options) {
            return remote.getBlobs(shas, options)
          }
        }
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
    return this.#run(async () => {
      await this.#sync()
      const source = await OverlaySource.create(this.source)
      const database = await this.database.overlay(source)
      try {
        return (await database.apply(mutations, {source, policy})).request
      } finally {
        await database.close()
      }
    })
  }

  mutate(mutations: Array<Mutation>): Promise<{sha: string}> {
    return this.#run(async () => {
      await this.#sync()
      const result = await this.database.apply(mutations, {source: this.source})
      await this.source.applyChanges(sourceChanges(result.request))
      return {sha: result.revision}
    })
  }

  write(request: CommitRequest): Promise<{sha: string}> {
    return this.#run(async () => {
      const tree = await this.source.getTree()
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

  async close(): Promise<void> {
    await this.#queue
    if (this.#close) await this.#close()
    else if (this.#ownsDatabase) await this.database.close()
  }

  [Symbol.asyncDispose](): Promise<void> {
    return this.close()
  }
}

export type {EntrySyncResult}
