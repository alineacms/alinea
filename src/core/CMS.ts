import {Config, createConfig} from './Config.js'
import {Connection} from './Connection.js'
import {Graph, GraphRealm} from './Graph.js'
import {MediaFile, MediaLibrary} from './media/MediaTypes.js'
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

  constructor(
    config: Definition,
    public connection: Connection | Promise<Connection>
  ) {
    const normalizedConfig = createConfig(config)
    const resolver: Resolver = {
      resolve: async params => {
        const {preview} = await this.getContext()
        const ctx = await this.connection
        return ctx.resolve({...params, preview})
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

  get schema(): Definition['schema'] & {
    MediaFile: typeof MediaFile
    MediaLibrary: typeof MediaLibrary
  } {
    return this.config.schema as any
  }

  get workspaces(): Definition['workspaces'] {
    return this.config.workspaces
  }
}
