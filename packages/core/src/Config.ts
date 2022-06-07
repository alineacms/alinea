import {Auth} from './Auth'
import {BackendConfig, BackendProps} from './BackendConfig'
import {createError} from './ErrorWithCode'
import {Root} from './Root'
import {Type} from './Type'
import {Workspace, WorkspaceConfig, Workspaces} from './Workspace'

/** Configuration options for the dashboard */
export class Config<T extends Workspaces = Workspaces> {
  workspaces: {
    [K in keyof T]: Workspace<T[K] extends WorkspaceConfig<infer W> ? W : any>
  }

  constructor(public options: ConfigOptions<T>) {
    this.workspaces = Object.fromEntries(
      Object.entries(this.options.workspaces).map(([name, config]) => {
        return [name, new Workspace(name, config)]
      })
    ) as any
  }

  get hasAuth() {
    return Boolean(this.options.backend?.auth)
  }

  get authView() {
    return this.options.backend?.auth.view
  }

  // Todo: supply a default for non-dev env
  createBackend(options: BackendProps) {
    const backendConfig = this.options.backend
    if (!backendConfig) throw createError('No backend config found')
    return backendConfig.configureBackend({...backendConfig, ...options})
  }

  /** Get the first workspace */
  get defaultWorkspace(): Workspace {
    const key = Object.keys(this.workspaces)[0]
    return this.workspaces[key]
  }

  /** Find a type by workspace and name */
  type = (workspace: string, name: string): Type | undefined => {
    const space = this.workspaces[workspace]
    if (!space) throw createError(404, `Workspace "${workspace}" not found`)
    return space.schema.type(name)
  }

  /** Get a root */
  root = (workspace: string, root: string): Root => {
    const space = this.workspaces[workspace]
    if (!space) throw createError(404, `Workspace "${workspace}" not found`)
    const maybeRoot = space.roots[root]
    if (!maybeRoot)
      throw createError(
        404,
        `Root "${root}" in workspace "${workspace}" not found`
      )
    return maybeRoot
  }
}

export namespace Config {
  export type Infer<T> = T extends Config<infer U> ? U : never
}

/** Configuration options */
export type ConfigOptions<T extends Workspaces> = {
  backend?: BackendConfig<any>
  /** The client side authentication view */
  auth?: Auth.View
  /** A record containing workspace configurations */
  workspaces: T
}

/** Create a new config instance */
export function createConfig<T extends Workspaces>(options: ConfigOptions<T>) {
  return new Config(options)
}
