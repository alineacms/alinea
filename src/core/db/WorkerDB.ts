import type {DBWorker} from 'alinea/dashboard/Worker'
import type {Config} from '../Config.js'
import type {Connection, UploadResponse} from '../Connection.js'
import type {AnyQueryResult, GraphQuery} from '../Graph.js'
import {getScope} from '../Scope.js'
import type {Mutation} from './Mutation.js'
import {WriteableGraph} from './WriteableGraph.js'

export class WorkerDB extends WriteableGraph {
  #worker: DBWorker
  #client: Connection

  constructor(
    public config: Config,
    worker: DBWorker,
    client: Connection,
    public index: EventTarget
  ) {
    super()
    this.#worker = worker
    this.#client = client
  }

  mutate(mutations: Array<Mutation>): Promise<string> {
    return this.#worker.mutate(mutations)
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
