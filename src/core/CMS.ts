import {Config} from './Config.js'
import {Driver} from './Driver.js'
import {Root} from './Root.js'
import {Workspace} from './Workspace.js'
import {DefaultDriver} from './driver/DefaultDriver.js'
import {entries} from './util/Objects.js'

export interface CMSApi {}

type Attachment = Workspace | Root
const attached = new WeakMap<Attachment, CMS>()

export class CMS implements Config, CMSApi {
  constructor(private config: Config, protected driver: Driver) {
    this.attach(config)
  }

  protected attach(config: Config) {
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

export function createCMS<Definition extends Config>(
  config: Definition,
  driver: Driver = new DefaultDriver(config)
): Definition & CMSApi {
  return new CMS(config, driver) as any
}
