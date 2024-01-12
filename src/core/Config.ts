import {CloudAuthView} from 'alinea/cloud/view/CloudAuth'
import {MediaSchema} from 'alinea/core/media/MediaSchema'
import {ComponentType} from 'react'
import {Auth} from './Auth.js'
import {Entry} from './Entry.js'
import {Schema} from './Schema.js'
import {Type} from './Type.js'
import {Workspace, WorkspaceData} from './Workspace.js'

export interface DashboardConfig {
  handlerUrl: string
  dashboardUrl: string
  auth?: Auth.View
  /** Compile all static assets for the dashboard to this dir */
  staticFile?: string
}

/** Configuration options */
export interface Config {
  /** A schema describing the types of entries */
  schema: Schema
  /** A record containing workspace configurations */
  workspaces: Record<string, Workspace>
  /** A url which will be embedded in the dashboard for live previews */
  preview?: string | ComponentType<{entry: Entry; previewToken: string}>
  /** Every edit will pass through a draft phase before being published */
  enableDrafts?: boolean

  /**
  publicDir?: string
  dashboardFile?: string
  handlerUrl?: 
  */

  dashboard?: DashboardConfig
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
  /*const publicDir = definition.publicDir ?? './public'
  const staticFile = definition.dashboard?.staticFile
  let dashboardFile = 'admin.html'
  if (staticFile) {
    if (staticFile.startsWith('public/'))
      dashboardFile = staticFile.slice('public/'.length)
    else
      throw new Error(
        `Usage of config.dashboard.staticFile is deprecated, please use config.dashboardFile`
      )
  }
  const handlerUrl = definition.handlerUrl ?? definition.dashboard?.handlerUrl*/
  return {
    ...definition,
    schema: {...MediaSchema, ...definition.schema},
    dashboard: {
      auth: CloudAuthView,
      ...definition.dashboard
    }
  }
}
