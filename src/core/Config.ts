import {Auth} from './Auth.js'
import {Schema} from './Schema.js'
import {Type} from './Type.js'
import {Workspace, WorkspaceData} from './Workspace.js'

export interface DashboardConfig {
  auth?: Auth.View
  handlerUrl: string
  dashboardUrl: string
  /** Compile all static assets for the dashboard to this dir */
  staticFile?: string
}

/** Configuration options */
export interface Config {
  schema: Schema
  /** A record containing workspace configurations */
  workspaces: Record<string, Workspace>
  // backend?: BackendConfig<any>
  dashboard?: DashboardConfig
  /** A url which will be embedded in the dashboard for live previews */
  preview?: string
}

export namespace Config {
  export function mainWorkspace(config: Config): WorkspaceData {
    const key = Object.keys(config.workspaces)[0]
    return Workspace.data(config.workspaces[key])
  }

  export function type(config: Config, name: string): Type | undefined {
    return config.schema[name]
  }

  export function hasAuth(config: Config): boolean {
    return Boolean(config.dashboard?.auth)
  }
}

/** Create a new config instance */
export function createConfig<Definition extends Config>(
  definition: Definition
) {
  return definition
}
