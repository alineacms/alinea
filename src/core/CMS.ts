import {Store} from 'alinea/backend/Store'
import {CloudAuthView} from 'alinea/cloud/view/CloudAuth'
import {MediaFile, MediaLibrary} from 'alinea/core/media/MediaSchema'
import {Config, DashboardConfig} from './Config.js'
import {Connection} from './Connection.js'
import {GraphRealm, GraphRealmApi} from './Graph.js'
import {Root} from './Root.js'
import {Schema} from './Schema.js'
import {Workspace} from './Workspace.js'
import {entries} from './util/Objects.js'
import {Resolver} from 'alinea/core'

type Attachment = Workspace | Root
const attached = new WeakMap<Attachment, CMS>()

export interface CMSApi extends GraphRealmApi {
  connection(): Promise<Resolver>
}

export abstract class CMS extends GraphRealm implements Config, CMSApi {
  schema: Schema
  dashboard: DashboardConfig

  constructor(config: Config) {
    super(config, async params => {
      const cnx = await this.connection()
      return cnx.resolve(params)
    })
    this.schema = {
      MediaLibrary,
      MediaFile,
      ...config.schema
    }
    this.dashboard = {
      auth: CloudAuthView,
      ...(config.dashboard as DashboardConfig)
    }
    this.#attach(config)
  }

  abstract connection(): Promise<Resolver>
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
