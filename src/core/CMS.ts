import {Store} from 'alinea/backend/Store'
import {Resolver} from 'alinea/core'
import {Config, createConfig} from './Config.js'
import {Graph, GraphRealm, GraphRealmApi} from './Graph.js'
import {Root} from './Root.js'
import {Workspace} from './Workspace.js'
import {entries} from './util/Objects.js'

type Attachment = Workspace | Root
const attached = new WeakMap<Attachment, CMS>()

export interface CMSApi extends GraphRealmApi {
  resolver(): Promise<Resolver>
}

export abstract class CMS extends GraphRealm implements CMSApi {
  graph: Graph
  config: Config

  constructor(config: Config) {
    const normalizedConfig = createConfig(config)
    super(normalizedConfig, async params => {
      const cnx = await this.resolver()
      return cnx.resolve(params)
    })
    this.config = normalizedConfig
    this.graph = new Graph(normalizedConfig, async params => {
      const {resolve} = await this.resolver()
      return resolve(params)
    })
    this.#attach(config)
  }

  abstract resolver(): Promise<Resolver>
  abstract readStore(): Promise<Store>

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
  export const Link = Symbol.for('@alinea/CMS.Link')

  export function instanceFor(attachment: Attachment): CMS {
    const cms = attached.get(attachment)
    if (!cms) throw new Error(`No CMS attached to ${attachment}`)
    return cms
  }
}
