import {CloudAuthView} from 'alinea/cloud/view/CloudAuth'
import {Preview} from 'alinea/core/Preview'
import {MediaFile, MediaLibrary} from 'alinea/core/media/MediaTypes'
import {Auth} from './Auth.js'
import {Schema} from './Schema.js'
import {Type} from './Type.js'
import {Workspace, WorkspaceData} from './Workspace.js'
import {isValidIdentifier} from './util/Identifiers.js'
import {entries} from './util/Objects.js'

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
  preview?: Preview
  /** Every edit will pass through a draft phase before being published */
  enableDrafts?: boolean
  /** The interval in seconds at which the frontend will poll for updates */
  syncInterval?: number

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

  export function validate(config: Config) {
    Schema.validate(config.schema)
    for (const [key, workspace] of entries(config.workspaces)) {
      if (!isValidIdentifier(key))
        throw new Error(
          `Invalid Workspace name "${key}", use only a-z, A-Z, 0-9, and _`
        )
      Workspace.validate(workspace, config.schema)
    }
  }
}

/** Create a new config instance */
export function createConfig<Definition extends Config>(
  definition: Definition
) {
  if (definition.schema.MediaFile && definition.schema.MediaFile !== MediaFile)
    throw new Error(`"MediaFile" is a reserved Type name`)
  if (
    definition.schema.MediaLibrary &&
    definition.schema.MediaLibrary !== MediaLibrary
  )
    throw new Error(`"MediaLibrary" is a reserved Type name`)
  const res = {
    ...definition,
    schema: {...definition.schema, MediaLibrary, MediaFile},
    dashboard: {
      auth: CloudAuthView,
      ...definition.dashboard
    }
  }
  Config.validate(res)
  return res
}
