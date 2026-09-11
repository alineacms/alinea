import type {Config} from '#/core/Config.js'
import type {
  GetBlobsOptions,
  RemoteSource,
  Source
} from '#/core/source/Source.js'
import {diff} from '#/core/source/Source.js'
import {OverlaySource} from '#/core/source/OverlaySource.js'
import type {ReadonlyTree} from '#/core/source/Tree.js'
import type {AnyQueryResult, GraphQuery} from '#/core/Graph.js'
import {createRecord} from '#/core/EntryRecord.js'
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
  type EntrySyncResult
} from './EntryDatabase.js'

/** Source and commit lifecycle around the transport-neutral SQLite database. */
export class EntryStore extends WriteableGraph implements AsyncDisposable {
  readonly config: Config
  readonly database: EntryDatabase
  readonly source: Source
  #ownsDatabase: boolean

  constructor(
    config: Config,
    database: EntryDatabase,
    source: Source,
    options: {ownsDatabase?: boolean} = {}
  ) {
    super()
    this.config = config
    this.database = database
    this.source = source
    this.#ownsDatabase = options.ownsDatabase ?? false
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
    return (await this.database.syncWith(this.source)).revision
  }

  /** Keep the writable source and its query database at one remote revision. */
  async syncWith(remote: RemoteSource): Promise<string> {
    const batch = await diff(this.source, remote)
    if (batch.changes.length) await this.source.applyChanges(batch)
    return this.sync()
  }

  /** Create a persistent copy-on-write session over this store. */
  async overlay(remote: RemoteSource): Promise<EntryStore> {
    const source = await OverlaySource.create(this.source)
    const batch = await diff(source, remote)
    if (batch.changes.length) await source.applyChanges(batch)
    const database = await this.database.overlay(source)
    return new EntryStore(this.config, database, source, {
      ownsDatabase: true
    })
  }

  /** Plan a commit without changing this store. */
  async request(
    mutations: ReadonlyArray<Mutation>,
    policy?: Policy
  ): Promise<CommitRequest> {
    await this.sync()
    const source = await OverlaySource.create(this.source)
    const database = await this.database.overlay(source)
    try {
      return (await database.apply(mutations, {source, policy})).request
    } finally {
      await database.close()
    }
  }

  async mutate(mutations: Array<Mutation>): Promise<{sha: string}> {
    const result = await this.database.apply(mutations, {source: this.source})
    await this.source.applyChanges(sourceChanges(result.request))
    return {sha: result.revision}
  }

  async write(request: CommitRequest): Promise<{sha: string}> {
    const tree = await this.source.getTree()
    if (tree.sha !== request.intoSha)
      await this.source.applyChanges(sourceChanges(request))
    const result = await this.database.syncWith(this.source)
    return {sha: result.revision}
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
    if (this.#ownsDatabase) await this.database.close()
  }

  [Symbol.asyncDispose](): Promise<void> {
    return this.close()
  }
}

export type {EntrySyncResult}
