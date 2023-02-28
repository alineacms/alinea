import type {Backend} from 'alinea/backend/Backend'
import {Auth} from './Auth.js'
import {BackendConfig, BackendProps} from './BackendConfig.js'
import {createError} from './ErrorWithCode.js'
import {Root} from './Root.js'
import {Schema} from './Schema.js'
import {Type} from './Type.js'
import {Workspace, WorkspaceConfig} from './Workspace.js'

/** Configuration options for the dashboard */
export class Config<T = any> {
  workspaces: Record<string, Workspace>

  constructor(public options: ConfigOptions<T>) {
    this.workspaces = Object.fromEntries(
      Object.entries(this.options.workspaces).map(([name, config]) => {
        return [name, new Workspace(name, config)]
      })
    ) as any
    this.schema.validate()
  }

  get schema() {
    return this.options.schema
  }

  get hasAuth() {
    return Boolean(this.options.backend?.auth)
  }

  get authView() {
    return this.options.backend?.auth?.view
  }

  get dashboard() {
    return this.options.dashboard
  }

  // Todo: supply a default for non-dev env
  createBackend(options: BackendProps): Backend {
    const backendConfig = this.options.backend
    if (!backendConfig) throw createError('No backend config found')
    return backendConfig.configureBackend({...backendConfig, ...options})
  }

  /** Get the first workspace */
  get firstWorkspace(): Workspace {
    const key = Object.keys(this.workspaces)[0]
    return this.workspaces[key]
  }

  /** Find a type by name */
  type = (name: string): Type | undefined => {
    return this.schema.type(name)
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
  export type infer<T> = T extends Config<infer U> ? U : never
}

/** Configuration options */
export type ConfigOptions<T> = {
  schema: Schema<T>
  /** A record containing workspace configurations */
  workspaces: Record<string, WorkspaceConfig>
  backend?: BackendConfig<any>
  /** The client side authentication view */
  auth?: Auth.View
  dashboard?: {
    handlerUrl: string
    dashboardUrl: string
    /** Compile all static assets for the dashboard to this dir */
    staticFile?: string
  }
}

/** Create a new config instance */
export function createConfig<T>(options: ConfigOptions<T>) {
  return new Config(options)
}
