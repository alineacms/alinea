import type {Backend} from 'alinea/backend/Backend'
import {BackendConfig, BackendProps} from './BackendConfig.js'
import {createError} from './ErrorWithCode.js'
import {Root} from './Root.js'
import {Schema} from './Schema.js'
import {Type} from './Type.js'
import {Workspace, WorkspaceData} from './Workspace.js'
import {keys} from './util/Objects.js'

/** Configuration options */
export interface ConfigDefinition {
  schema: Schema
  /** A record containing workspace configurations */
  workspaces: Record<string, Workspace>
  backend?: BackendConfig<any>
  // preview
  dashboard?: {
    handlerUrl: string
    dashboardUrl: string
    /** Compile all static assets for the dashboard to this dir */
    staticFile?: string
  }
}

export type Config = ConfigDefinition

export namespace Config {
  export function createBackend(
    config: Config,
    options: BackendProps
  ): Backend {
    const backendConfig = config.backend
    if (!backendConfig) throw createError('No backend config found')
    return backendConfig.configureBackend({...backendConfig, ...options})
  }

  export function mainWorkspace(config: Config): WorkspaceData {
    const key = Object.keys(config.workspaces)[0]
    return Workspace.data(config.workspaces[key])
  }

  export function type(config: Config, name: string): Type | undefined {
    return config.schema[name]
  }

  export function workspaceName(config: Config, workspace: Workspace): string {
    const name = keys(config.workspaces).find(
      key => config.workspaces[key] === workspace
    )
    if (!name) throw createError(404, `Workspace not found`)
    return name
  }

  export function root(config: Config, workspace: string, root: string): Root {
    const space = config.workspaces[workspace]
    if (!space) throw createError(404, `Workspace "${workspace}" not found`)
    const maybeRoot = space[root]
    if (!maybeRoot)
      throw createError(
        404,
        `Root "${root}" in workspace "${workspace}" not found`
      )
    return maybeRoot
  }

  export function hasAuth(config: Config): boolean {
    return Boolean(config.backend?.auth)
  }
}

/** Create a new config instance */
export function createConfig<Definition extends ConfigDefinition>(
  definition: Definition
) {
  return definition
}
