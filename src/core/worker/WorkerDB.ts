import type {Config} from '../Config.js'
import type {Connection, UploadResponse} from '../Connection.js'
import type {AnyQueryResult, GraphQuery} from '../Graph.js'
import {createId} from '../Id.js'
import {getScope} from '../Scope.js'
import type {Mutation} from '../db/Mutation.js'
import {WriteableGraph} from '../db/WriteableGraph.js'
import type {DashboardWorker} from './LoadWorker.js'

export class WorkerDB extends WriteableGraph {
  #worker: DashboardWorker
  #client: Connection

  constructor(
    public config: Config,
    worker: DashboardWorker,
    client: Connection,
    public index: EventTarget
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

  prepareUpload(file: string): Promise<UploadResponse> {
    return this.#client.prepareUpload(file)
  }
}
