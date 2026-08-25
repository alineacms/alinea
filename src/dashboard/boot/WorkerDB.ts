import type {Config} from '#/core/Config.js'
import type {
  Connection,
  UploadMetadata,
  UploadResponse
} from '#/core/Connection.js'
import type {AnyQueryResult, GraphQuery} from '#/core/Graph.js'
import {createId} from '#/core/Id.js'
import {getScope} from '#/core/Scope.js'
import type {
  EntryReferenceQuery,
  EntryReferenceResult
} from '#/core/db/EntryReference.js'
import type {Mutation} from '#/core/db/Mutation.js'
import {
  entryWritesFromMutations,
  type EntryWrite
} from '#/core/db/EntryWrite.js'
import {WriteableGraph} from '#/core/db/WriteableGraph.js'
import type {DashboardWorker} from './DashboardWorker.js'
import type {Activity} from './ActivityEvent.js'

export class WorkerDB extends WriteableGraph {
  #worker: DashboardWorker
  #client: Connection

  constructor(
    public config: Config,
    worker: DashboardWorker,
    client: Connection,
    public events: EventTarget
  ) {
    super()
    this.#worker = worker
    this.#client = client
  }

  async mutate(mutations: Array<Mutation>): Promise<{id: string; sha: string}> {
    return this.writeEntries(entryWritesFromMutations(mutations))
  }

  async writeEntries(
    writes: Array<EntryWrite>
  ): Promise<{id: string; sha: string}> {
    const id = createId()
    return {id, sha: await this.#worker.queue(id, writes)}
  }

  resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    const scope = getScope(this.config)
    const body = scope.stringify(query)
    return this.#worker.resolve(body) as Promise<AnyQueryResult<Query>>
  }

  sync(): Promise<string> {
    return this.#worker.sync()
  }

  get sha(): Promise<string> {
    return this.#worker.sha()
  }

  referencesTo(query: EntryReferenceQuery): Promise<EntryReferenceResult> {
    return this.#worker.referencesTo(query)
  }

  retryActivity(): Promise<void> {
    return this.#worker.retryActivity()
  }

  discardActivity(): Promise<void> {
    return this.#worker.discardActivity()
  }

  async activities(): Promise<Array<Activity>> {
    return this.#worker.activities()
  }

  prepareUpload(
    file: string,
    metadata?: UploadMetadata
  ): Promise<UploadResponse> {
    return this.#client.prepareUpload(file, metadata)
  }
}
