import {Auth} from './Auth'
import {createError} from './ErrorWithCode'
import {Type} from './Type'
import {Workspace, Workspaces} from './Workspace'

/** Configuration options for the dashboard */
export class Config<T extends Workspaces = Workspaces> {
  constructor(public options: ConfigOptions<T>) {}

  /** Get the first workspace */
  get defaultWorkspace(): Workspace {
    return this.workspaces[Object.keys(this.workspaces)[0]]
  }

  /** All workspaces */
  get workspaces(): T {
    return this.options.workspaces
  }

  /** Find a type by workspace and name */
  type = (workspace: string, name: string): Type | undefined => {
    const space = this.workspaces[workspace]
    if (!space) throw createError(404, `Workspace "${workspace}" not found`)
    return space.schema.type(name)
  }
}

/** Configuration options */
export type ConfigOptions<T> = {
  /** The client side authentication view */
  auth?: Auth.View
  /** A record containing workspace configurations */
  workspaces: T
}

/** Create a new config instance */
export function createConfig<T extends Workspaces>(options: ConfigOptions<T>) {
  return new Config(options)
}
