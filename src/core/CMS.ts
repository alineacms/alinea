import {Config, createConfig} from './Config.js'
import {Connection} from './Connection.js'
import {Graph} from './Graph.js'
import {MediaFile, MediaLibrary} from './media/MediaTypes.js'
import {PreviewRequest} from './Preview.js'
import {Resolver} from './Resolver.js'
import {Operation} from './Transaction.js'

export interface ConnectionContext {
  apiKey?: string
  accessToken?: string
  preview?: PreviewRequest
}

export class CMS<Definition extends Config = Config> extends Graph {
  config: Definition
  connect: () => Promise<Connection>

  constructor(config: Definition, connect: () => Promise<Connection>) {
    const normalizedConfig = createConfig(config)
    const resolver: Resolver = {
      resolve: async query => {
        const connection = await connect()
        return connection.resolve(query)
      }
    }
    super(normalizedConfig, resolver)
    this.connect = connect
    this.config = normalizedConfig
  }

  async commit(...operations: Array<Operation>) {
    const mutations = await Promise.all(
      operations.flatMap(op => op[Operation.Data](this))
    )
    const cnx = await this.connect()
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
