import {Store} from 'alinea/backend/Store'
import {CloudAuthView} from 'alinea/cloud/view/CloudAuth'
import {Resolver} from 'alinea/core'
import {MediaFile, MediaLibrary} from 'alinea/core/media/MediaSchema'
import {Config, DashboardConfig} from './Config.js'
import {Graph, GraphRealm, GraphRealmApi} from './Graph.js'
import {Root} from './Root.js'
import {Workspace} from './Workspace.js'
import {entries} from './util/Objects.js'

type Attachment = Workspace | Root
const attached = new WeakMap<Attachment, CMS>()

export interface CMSApi extends GraphRealmApi {
  resolver(): Promise<Resolver>
}

export abstract class CMS extends GraphRealm implements Config, CMSApi {
  dashboard: DashboardConfig
  graph: Graph

  constructor(config: Config) {
    const withMedia = {
      ...config,
      schema: {MediaLibrary, MediaFile, ...config.schema}
    }
    super(withMedia, async params => {
      const cnx = await this.resolver()
      return cnx.resolve(params)
    })
    this.dashboard = {
      auth: CloudAuthView,
      ...(config.dashboard as DashboardConfig)
    }
    this.graph = new Graph(this, async params => {
      const {resolve} = await this.resolver()
      return resolve(params)
    })
    this.#attach(config)
  }

  abstract resolver(): Promise<Resolver>
  abstract exportStore(cwd: string, store: Uint8Array): Promise<void>
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

  get preview() {
    return this.config.preview
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
