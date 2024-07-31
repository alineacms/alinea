import {Config, createConfig} from './Config.js'
import {Connection} from './Connection.js'
import {Graph, GraphRealm} from './Graph.js'
import {PreviewRequest, Resolver} from './Resolver.js'
import {Operation} from './Transaction.js'

export interface ConnectionContext {
  accessToken?: string
  preview?: PreviewRequest
  apiKey?: string
}

export class CMS<Definition extends Config = Config> extends GraphRealm {
  graph: Graph
  config: Definition

  constructor(config: Definition, public connection: Promise<Connection>) {
    const normalizedConfig = createConfig(config)
    const resolver: Resolver = {
      resolve: params => {
        return connection.then(cnx => cnx.resolve(params))
      }
    }
    super(normalizedConfig, resolver)
    this.config = normalizedConfig
    this.graph = new Graph(normalizedConfig, resolver)
  }

  async getContext(): Promise<ConnectionContext> {
    return {}
  }

  async commit(...operations: Array<Operation>) {
    const mutations = await Promise.all(
      operations.flatMap(op => op[Operation.Data](this))
    )
    const cnx = await this.connection
    return cnx.mutate(mutations.flat())
  }

  get schema(): Definition['schema'] {
    return this.config.schema
  }

  get workspaces(): Definition['workspaces'] {
    return this.config.workspaces
  }
}
