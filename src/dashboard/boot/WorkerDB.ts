import type {Config} from '#/core/Config.js'
import type {Connection, UploadResponse} from '#/core/Connection.js'
import type {AnyQueryResult, GraphQuery} from '#/core/Graph.js'
import {createId} from '#/core/Id.js'
import {getScope} from '#/core/Scope.js'
import type {Mutation} from '#/core/db/Mutation.js'
import {WriteableGraph} from '#/core/db/WriteableGraph.js'
import type {DashboardWorker} from './DashboardWorker.js'

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
    const id = createId()
    return {id, sha: await this.#worker.queue(id, mutations)}
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

  retryMutationQueue(): Promise<void> {
    return this.#worker.retryQueue()
  }

  discardMutationQueue(): void {
    this.#worker.discardQueue()
  }

  prepareUpload(file: string): Promise<UploadResponse> {
    return this.#client.prepareUpload(file)
  }
}
