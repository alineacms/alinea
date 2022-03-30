import {Auth} from './Auth'
import {createError} from './ErrorWithCode'
import {Type} from './Type'
import {Workspace, Workspaces} from './Workspace'

export class Config<T extends Workspaces = Workspaces> {
  constructor(public options: ConfigOptions<T>) {}

  get defaultWorkspace(): Workspace {
    return this.workspaces[Object.keys(this.workspaces)[0]]
  }

  get workspaces(): T {
    return this.options.workspaces
  }

  type(workspace: string, name: string): Type | undefined {
    const space = this.workspaces[workspace]
    if (!space) throw createError(404, `Workspace "${workspace}" not found`)
    return space.schema.type(name)
  }
}

export type ConfigOptions<T> = {
  // Todo: move to dashboard
  auth?: Auth.View
  /** A record containing workspace configurations */
  workspaces: T
}

export function createConfig<T extends Workspaces>(options: ConfigOptions<T>) {
  return new Config(options)
}
