import type {AnyQueryResult, GraphQuery} from '#/core/Graph.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import type {
  GetBlobsOptions,
  RemoteSource,
  Source
} from '#/core/source/Source.js'
import {trace} from '#/core/Trace.js'
import type {Config} from '#/core/Config.js'
import type {UploadMetadata, UploadResponse} from '#/core/Connection.js'
import type {CommitRequest} from '#/core/db/CommitRequest.js'
import type {
  EntryReferenceQuery,
  EntryReferenceResult
} from '#/core/db/EntryReference.js'
import {IndexEvent} from '#/core/db/IndexEvent.js'
import type {LocalStore, SyncOptions} from '#/core/db/LocalStore.js'
import type {Mutation} from '#/core/db/Mutation.js'
import {WriteableGraph} from '#/core/db/WriteableGraph.js'
import type {Policy} from '#/core/Role.js'
import {EntryStore} from './EntryStore.js'

/**
 * Sync-constructor convenience over `EntryStore.memory()`.
 * This facade is backed by the SQLite engine.
 */
export class LocalDB
  extends WriteableGraph
  implements LocalStore, AsyncDisposable
{
  readonly config: Config
  readonly source: Source
  readonly events = new EventTarget()
  #store: Promise<EntryStore>

  constructor(config: Config, source: Source = new MemorySource()) {
    super()
    this.config = config
    this.source = source
    this.#store = EntryStore.memory(config, source).then(store => {
      store.onChange(change => {
        this.events.dispatchEvent(
          new IndexEvent({
            op: 'index',
            sha: change.revision,
            ids: [...change.changedEntryIds]
          })
        )
      })
      return store
    })
  }

  get sha(): Promise<string> {
    return this.#store.then(store => store.sha)
  }

  async includedAtBuild(filePath: string): Promise<boolean> {
    return (await this.#store).includedAtBuild(filePath)
  }

  resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    const span = trace(this.config, 'alinea.local_db.resolve')
    return span(async () => (await this.#store).resolve(query))
  }

  referencesTo(query: EntryReferenceQuery): Promise<EntryReferenceResult> {
    return this.#store.then(store => store.referencesTo(query))
  }

  getTreeIfDifferent(sha: string) {
    return this.source.getTreeIfDifferent(sha)
  }

  getBlobs(shas: ReadonlyArray<string>, options?: GetBlobsOptions) {
    return this.source.getBlobs(shas, options)
  }

  sync(): Promise<string> {
    const span = trace(this.config, 'alinea.local_db.sync')
    return span(async () => (await this.#store).sync())
  }

  syncWith(remote: RemoteSource, options?: SyncOptions): Promise<string> {
    const span = trace(this.config, 'alinea.local_db.sync_with')
    return span(async () => (await this.#store).syncWith(remote, options))
  }

  async request(
    mutations: ReadonlyArray<Mutation>,
    policy?: Policy
  ): Promise<CommitRequest> {
    return (await this.#store).request(mutations, policy)
  }

  async mutate(mutations: Array<Mutation>): Promise<{sha: string}> {
    return (await this.#store).mutate(mutations)
  }

  async write(request: CommitRequest): Promise<{sha: string}> {
    return (await this.#store).write(request)
  }

  prepareUpload(
    _file: string,
    _metadata?: UploadMetadata
  ): Promise<UploadResponse> {
    return Promise.reject(new Error('Uploads not supported on local DB'))
  }

  async close(): Promise<void> {
    await (await this.#store).close()
  }

  [Symbol.asyncDispose](): Promise<void> {
    return this.close()
  }
}
