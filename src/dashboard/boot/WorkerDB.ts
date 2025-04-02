import type {Config} from 'alinea/core/Config'
import type {Connection, UploadResponse} from 'alinea/core/Connection'
import type {AnyQueryResult, GraphQuery} from 'alinea/core/Graph'
import {createId} from 'alinea/core/Id'
import {getScope} from 'alinea/core/Scope'
import type {Mutation} from 'alinea/core/db/Mutation'
import {WriteableGraph} from 'alinea/core/db/WriteableGraph'
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

  prepareUpload(file: string): Promise<UploadResponse> {
    return this.#client.prepareUpload(file)
  }
}
