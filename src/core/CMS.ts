import {Config, createConfig} from './Config.js'
import {Connection} from './Connection.js'
import {Graph, GraphRealm} from './Graph.js'
import {Resolver} from './Resolver.js'
import {Root} from './Root.js'
import {Operation, Transaction} from './Transaction.js'
import {Workspace} from './Workspace.js'
import {entries} from './util/Objects.js'

type Attachment = Workspace | Root
const attached = new WeakMap<Attachment, CMS>()

export abstract class CMS extends GraphRealm {
  graph: Graph
  config: Config

  constructor(config: Config) {
    const normalizedConfig = createConfig(config)
    const resolver: Resolver = {
      resolve: params => {
        return this.resolver().then(r => r.resolve(params))
      }
    }
    super(normalizedConfig, resolver)
    this.config = normalizedConfig
    this.graph = new Graph(normalizedConfig, resolver)
    //this.#attach(config)
  }

  abstract resolver(): Promise<Resolver>
  abstract connection(): Promise<Connection>

  commit(...operations: Array<Operation>) {
    return Transaction.commit(
      this,
      operations.map(op => op[Operation.Data]).flat()
    )
  }

  #attach(config: Config) {
    for (const [name, workspace] of entries(config.workspaces)) {
      if (attached.has(workspace))
        throw new Error(`Workspace is already attached to a CMS: ${name}`)
      attached.set(workspace, this)
      for (const [name, root] of entries(workspace)) {
        if (attached.has(root))
          throw new Error(`Root is already attached to a CMS: ${name}`)
        attached.set(root, this)
      }
    }
  }

  get schema() {
    return this.config.schema
  }

  get workspaces() {
    return this.config.workspaces
  }
}

export namespace CMS {
  export function instanceFor(attachment: Attachment): CMS {
    const cms = attached.get(attachment)
    if (!cms) throw new Error(`No CMS attached to ${attachment}`)
    return cms
  }
}
