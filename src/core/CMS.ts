import {Config, createConfig} from './Config.js'
import {Connection} from './Connection.js'
import {Graph} from './Graph.js'
import {MediaFile, MediaLibrary} from './media/MediaTypes.js'
import {PreviewRequest} from './Preview.js'
import {Resolver} from './Resolver.js'
import {
  CreateOperation,
  CreateQuery,
  DeleteOp,
  Operation,
  UpdateOperation,
  UpdateQuery,
  UploadOperation,
  UploadQuery
} from './Transaction.js'

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

  async update<Definition>(query: UpdateQuery<Definition>) {
    const op = new UpdateOperation<Definition>(query)
    await this.commit(op)
    return this.get({
      type: query.type,
      id: query.id,
      locale: query.locale,
      status: query.status
    })
  }

  async create<Definition>(query: CreateQuery<Definition>) {
    const op = new CreateOperation<Definition>(query)
    await this.commit(op)
    return this.get({
      type: query.type,
      id: op.id,
      locale: query.locale,
      status: 'preferPublished'
    })
  }

  async remove(...entryIds: Array<string>): Promise<void> {
    await this.commit(new DeleteOp(entryIds))
  }

  async upload(query: UploadQuery) {
    const op = new UploadOperation(query)
    await this.commit(op)
    return this.get({type: MediaFile, id: op.id})
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
