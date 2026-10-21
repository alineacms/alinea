import type {ImageResizeOptions} from '#/core/media/ImageTransform.js'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import type {Preview} from '#/core/Preview.js'
import type {Auth} from './Auth.js'
import {getWorkspace} from './Internal.js'
import {admin, type Role} from './Role.js'
import {Root, type RootI18n} from './Root.js'
import {Schema} from './Schema.js'
import {getScope} from './Scope.js'
import type {Tracer} from './Trace.js'
import {Type} from './Type.js'
import {isValidIdentifier} from './util/Identifiers.js'
import {entries, values} from './util/Objects.js'
import * as paths from './util/Paths.js'
import {Workspace, type WorkspaceInternal} from './Workspace.js'
import {RecordField} from './field/RecordField.js'
import {UnionField} from './field/UnionField.js'
import {Field} from './Field.js'
import {JsonField} from '#/field/json/JsonField.js'
import {inheritsLocales, LocalisedField} from '#/field/localiser/Localiser.js'

/** Configuration options */
export interface Config {
  /** A schema describing the types of entries */
  schema: Schema
  /** A record containing workspace configurations */
  workspaces: Record<string, Workspace>

  /** A record containing roles */
  roles?: Record<string, Role>

  /** A url which will be embedded in the dashboard for live previews */
  preview?: Preview
  /** Every edit will pass through a draft status before being published */
  enableDrafts?: boolean
  /**
   * Fallback interval in seconds for polling content updates (freshness is
   * primarily sha-driven). In Next.js it also sets how long renders share the
   * latest content sha, which bounds how soon edits made outside the handler
   * show up: five minutes when unset.
   */
  syncInterval?: number
  /** Maximum file upload size in bytes */
  maxUploadSize?: number
  /**
   * Scale down jpeg, png and webp uploads larger than these dimensions before
   * they are stored, the dashboard resizes them in the browser. Defaults to
   * 2560 by 2560 pixels, false keeps uploads as they are.
   */
  resizeImages?: ImageResizeOptions | false

  /** The base url of the application */
  baseUrl?: string | {development?: string; production?: string}
  /** The url of the handler endpoint */
  handlerUrl?: string
  /** The public path where Alinea is mounted, defaults to /admin */
  adminPath?: string
  /** The folder where public assets are stored, defaults to /public. */
  publicDir?: string
  /**
   * Filename of the generated dashboard, defaults to admin.html.
   * @deprecated Use adminPath instead.
   */
  dashboardFile?: string

  /** Optional application-owned instrumentation for Alinea operations. */
  tracer?: Tracer

  auth?: Auth.View
}

export namespace Config {
  export function baseUrl(
    config: Config,
    env = process.env.NODE_ENV ?? 'production'
  ) {
    const result =
      typeof config.baseUrl === 'object'
        ? (config.baseUrl as Record<string, string>)[env]
        : config.baseUrl
    if (!result) return result
    if (result.includes('://')) return result
    return `https://${result}`
  }

  export function handlerUrl(config: Config): string {
    if (
      typeof config.handlerUrl !== 'string' ||
      config.handlerUrl.trim().length === 0
    )
      throw new Error('Missing handlerUrl in Alinea config')
    return config.handlerUrl
  }

  /**
   * The handler as reached from server renders. There is no request to take
   * an origin from in static renders, and reading one would make every route
   * dynamic, so a relative handlerUrl needs a baseUrl.
   */
  export function serverHandlerUrl(
    config: Config,
    env = process.env.NODE_ENV ?? 'production'
  ): URL {
    const handlerUrl = Config.handlerUrl(config)
    const absolute = URL.parse(handlerUrl)
    if (absolute) return absolute
    const base = Config.baseUrl(config, env)
    if (!base)
      throw new Error(
        `Missing baseUrl in Alinea config: set baseUrl.${env} to the url of ` +
          `your site, server renders reach the handler at ${handlerUrl} ` +
          `through it`
      )
    return new URL(handlerUrl, base)
  }

  export function adminPath(config: Config) {
    if (config.adminPath) return normalizeUrlPath(config.adminPath)
    const file = config.dashboardFile ?? 'admin.html'
    return normalizeUrlPath(paths.basename(file, '.html'))
  }

  export function filePathname(config: Config, file: string) {
    return paths.join(adminPath(config), 'file', file)
  }

  export function dashboardFile(config: Config) {
    if (!config.adminPath && config.dashboardFile) return config.dashboardFile
    return `${paths.relative('/', adminPath(config))}.html`
  }

  export function mainWorkspace(config: Config): WorkspaceInternal {
    const key = Object.keys(config.workspaces)[0]
    return getWorkspace(config.workspaces[key])
  }

  export function type(config: Config, name: string): Type | undefined {
    return config.schema[name]
  }

  /**
   * Whether entries of a type can be placed at the top level of a root. Roots
   * that do not list the types they contain accept every type, media roots
   * always hold files.
   */
  export function rootContains(
    config: Config,
    root: Root,
    childType: Type
  ): boolean {
    const allowed = Root.contains(root)
    if (allowed.length === 0) return true
    if (Root.isMediaRoot(root) && childType === MediaFile) return true
    const scope = getScope(config)
    const typeName = scope.nameOf(childType)
    for (const type of allowed) {
      if (typeof type === 'string') {
        if (type === typeName) return true
      } else {
        const name = scope.nameOf(type)
        if (name === typeName) return true
      }
    }
    return false
  }

  export function typeContains(
    config: Config,
    parentType: Type,
    childType: Type
  ): boolean {
    const allowed = Type.contains(parentType)
    if (allowed.length === 0) return false
    const scope = getScope(config)
    const typeName = scope.nameOf(childType)
    for (const type of allowed) {
      if (typeof type === 'string') {
        if (type === typeName) return true
      } else {
        const name = scope.nameOf(type)
        if (name === typeName) return true
      }
    }
    return false
  }

  export function hasAuth(config: Config): boolean {
    return Boolean(config.auth)
  }

  export function multipleWorkspaces(config: Config): boolean {
    return Object.keys(config.workspaces).length > 1
  }

  export function contentDir(config: Config) {
    const workspace = mainWorkspace(config)
    if (multipleWorkspaces(config)) return paths.dirname(workspace.source)
    return workspace.source
  }

  export function filePath(
    config: Config,
    workspace: string,
    root: string,
    locale: string | null,
    ...rest: Array<string>
  ) {
    const hasMultipleWorkspaces = multipleWorkspaces(config)
    let result = ''
    if (hasMultipleWorkspaces) result = paths.join(result, workspace)
    result = paths.join(result, root)
    if (locale) result = paths.join(result, locale.toLowerCase())
    return paths.join(result, ...rest)
  }

  /** The locales of the `Field.localised` fields of a root, if it has them */
  export function fieldI18n(
    config: Config,
    workspace: string,
    root: string
  ): RootI18n | undefined {
    const workspaceConfig = config.workspaces[workspace]
    const rootConfig =
      workspaceConfig && getWorkspace(workspaceConfig).roots[root]
    return rootConfig && Root.fieldI18n(Root.data(rootConfig))
  }

  export function validate(config: Config) {
    Schema.validate(config.schema)
    validateLocalisedFields(config)
    const all = entries(config.workspaces)
    let sourceDir: string
    for (const [key, workspace] of all) {
      if (!isValidIdentifier(key))
        throw new Error(
          `Invalid Workspace name "${key}", use only a-z, A-Z, 0-9, and _`
        )
      Workspace.validate(workspace, config.schema)
      if (all.length > 1) {
        const source = getWorkspace(workspace).source
        const dir = paths.dirname(source)
        const name = paths.basename(source)
        if (name !== key)
          throw new Error(
            `Workspace "${key}" source directory "${name}" must be named "${key}"`
          )
        sourceDir ??= dir
        if (sourceDir !== dir)
          throw new Error(
            `Workspaces "${key}" must be a directory of "${sourceDir}"`
          )
      }
    }
  }

  export function referencedViews(config: Config): Array<string> {
    return Schema.referencedViews(config.schema).concat(
      values(config.workspaces).flatMap(Workspace.referencedViews)
    )
  }
}

function normalizeUrlPath(value: string): string {
  const normalized = paths.join('/', value, '.')
  if (normalized === '/') throw new Error('adminPath must not be the root path')
  return normalized
}

const normalized = new WeakSet()

/** Create a new config instance */
export function createConfig<Definition extends Config>(
  definition: Definition
): Definition {
  if (normalized.has(definition)) return definition
  if (definition.schema.MediaFile && definition.schema.MediaFile !== MediaFile)
    throw new Error(`"MediaFile" is a reserved Type name`)
  if (
    definition.schema.MediaLibrary &&
    definition.schema.MediaLibrary !== MediaLibrary
  )
    throw new Error(`"MediaLibrary" is a reserved Type name`)
  const res = {
    ...definition,
    roles: {admin, ...definition.roles},
    publicDir: definition.publicDir ?? '/public',
    schema: {...definition.schema, MediaLibrary, MediaFile}
  }
  Config.validate(res)
  normalized.add(res)
  return res
}

/**
 * A `Field.localised` without locales of its own takes them from the root of
 * its entry. Roots that translate entries have no use for it, and a root
 * without i18n stores the plain value, which can't be told apart from a value
 * per locale when it is an object itself.
 */
function validateLocalisedFields(config: Config) {
  const typeNames = Schema.typeNames(config.schema)
  for (const [workspaceName, workspace] of entries(config.workspaces)) {
    for (const [rootName, root] of entries(getWorkspace(workspace).roots)) {
      const data = Root.data(root)
      if (data.fieldI18n) continue
      for (const type of rootTypes(config, root)) {
        for (const field of localisedFields(type)) {
          const inner = field.localisation.inner
          const where = `Field.localised("${Field.label(field)}") in type "${typeNames.get(type)}"`
          const location = `root "${rootName}" of workspace "${workspaceName}"`
          if (data.i18n)
            throw new Error(
              `${where} takes the locales of its root, but ${location} translates entries. Use i18n: {translate: 'fields'}, or pass the locales to Field.localised.`
            )
          if (holdsRecord(inner))
            throw new Error(
              `${where} holds an object, which needs locales: ${location} has no i18n. Use i18n: {translate: 'fields'}, or pass the locales to Field.localised.`
            )
        }
      }
    }
  }
}

/** The types entries of a root can have, also as descendants */
function rootTypes(config: Config, root: Root): Set<Type> {
  const contains = Root.contains(root)
  const queue =
    contains.length === 0
      ? values(config.schema)
      : contains.map(inner =>
          typeof inner === 'string' ? config.schema[inner] : inner
        )
  const result = new Set<Type>()
  for (const type of queue) {
    if (!type || result.has(type)) continue
    result.add(type)
    for (const inner of Type.contains(type))
      queue.push(typeof inner === 'string' ? config.schema[inner] : inner)
  }
  return result
}

/** The fields of a type that take the locales of their root, also nested */
function localisedFields(
  type: Type,
  seen = new Set<Type>()
): Array<LocalisedField<string, unknown, unknown, unknown>> {
  if (seen.has(type)) return []
  seen.add(type)
  return values(Type.fields(type)).flatMap(field => {
    const own = inheritsLocales(field)
      ? [field as LocalisedField<string, unknown, unknown, unknown>]
      : []
    const inner =
      field instanceof LocalisedField ? field.localisation.inner : field
    return [
      ...own,
      ...Field.nestedTypes(inner).flatMap(nested =>
        localisedFields(nested, seen)
      )
    ]
  })
}

function holdsRecord(field: Field): boolean {
  return (
    field instanceof RecordField ||
    field instanceof UnionField ||
    field instanceof JsonField
  )
}
