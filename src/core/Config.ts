import {CloudAuthView} from 'alinea/cloud/view/CloudAuth'
import {Preview} from 'alinea/core/Preview'
import {MediaFile, MediaLibrary} from 'alinea/core/media/MediaTypes'
import {Auth} from './Auth.js'
import {getWorkspace} from './Internal.js'
import {Schema} from './Schema.js'
import {Type} from './Type.js'
import {Workspace, WorkspaceInternal} from './Workspace.js'
import {isValidIdentifier} from './util/Identifiers.js'
import {entries, values} from './util/Objects.js'

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

  /** The base url of the application */
  baseUrl?: string | {development?: string; production?: string}
  /** The url of the handler endpoint */
  handlerUrl?: string
  /** The folder where public assets are stored, defaults to /public */
  publicDir?: string
  /** Filename of the generated dashboard */
  dashboardFile?: string

  auth?: Auth.View
}

export namespace Config {
  export function baseUrl(
    config: Config,
    env = (process.env.NODE_ENV as 'development' | 'production') ?? 'production'
  ) {
    const result =
      typeof config.baseUrl === 'object' ? config.baseUrl[env] : config.baseUrl
    if (!result) return result
    if (result.includes('://')) return result
    return `https://${result}`
  }
  export function mainWorkspace(config: Config): WorkspaceInternal {
    const key = Object.keys(config.workspaces)[0]
    return getWorkspace(config.workspaces[key])
  }

  export function type(config: Config, name: string): Type | undefined {
    return config.schema[name]
  }

  export function hasAuth(config: Config): boolean {
    return Boolean(config.auth)
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

  export function referencedViews(config: Config): Array<string> {
    return Schema.referencedViews(config.schema).concat(
      values(config.workspaces).flatMap(Workspace.referencedViews)
    )
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
    publicDir: definition.publicDir ?? '/public',
    schema: {...definition.schema, MediaLibrary, MediaFile},
    auth: CloudAuthView
  }
  Config.validate(res)
  return res
}
