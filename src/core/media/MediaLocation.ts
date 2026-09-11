import {Config} from '../Config.js'
import {Workspace} from '../Workspace.js'
import {contains, join, normalize, relative} from '../util/Paths.js'

export const MEDIA_LOCATION = '@alinea.location'

export interface MediaPublicUrlMeta {
  /** The media entry path without its extension. */
  path: string
  /** The paths of parent media directories. */
  parentPaths: Array<string>
  /** The file extension, including its leading dot. */
  extension: string
  /** The location stored in the media entry, excluding mediaDir. */
  location: string
  workspace: string
  root: string
}

export interface MediaEntryUrlMeta {
  defaultUrl: string
  parentPaths: Array<string>
  path: string
  workspace: string
  root: string
  data: Record<string, unknown>
}

/** Maps media entry locations between storage and public URLs. */
export namespace MediaLocation {
  /** The workspace directory where media files are physically stored. */
  export function directory(config: Config, workspace: string): string {
    return Workspace.data(config.workspaces[workspace]).mediaDir ?? ''
  }

  /** Convert an entry-relative media location to its physical storage path. */
  export function storagePath(
    config: Config,
    workspace: string,
    location: string
  ): string {
    return join(directory(config, workspace), location)
  }

  /** Remove the workspace storage directory from a prepared upload location. */
  export function entryLocation(
    config: Config,
    workspace: string,
    location: string
  ): string {
    const mediaDir = directory(config, workspace)
    if (!mediaDir) return location
    const normalizedDir = join('/', normalize(mediaDir))
    const normalizedLocation = join('/', normalize(location))
    if (normalizedLocation === normalizedDir) return ''
    if (!contains(normalizedDir, normalizedLocation)) return location
    return join('/', relative(normalizedDir, normalizedLocation))
  }

  /** Resolve the deployed public location of a stored media file. */
  export function sourceUrl(
    config: Config,
    workspace: string,
    location: string
  ): string | undefined {
    if (/^https?:\/\//.test(location)) return location
    if (!directory(config, workspace)) return location
    const publicDir = join('/', config.publicDir ?? '/public')
    const storage = join('/', storagePath(config, workspace, location))
    if (!contains(publicDir, storage)) return
    return join('/', relative(publicDir, storage))
  }

  /** Resolve the public URL used to serve a media entry. */
  export function publicUrl(config: Config, meta: MediaPublicUrlMeta): string {
    const file = join(...meta.parentPaths, `${meta.path}${meta.extension}`)
    return Config.filePathname(config, file)
  }

  /** Add an immutable media version without changing its canonical path. */
  export function versionedUrl(url: string, version: string | undefined) {
    if (!version) return url
    const fragmentAt = url.indexOf('#')
    const base = fragmentAt === -1 ? url : url.slice(0, fragmentAt)
    const fragment = fragmentAt === -1 ? '' : url.slice(fragmentAt)
    const separator = base.includes('?') ? '&' : '?'
    return `${base}${separator}v=${encodeURIComponent(version)}${fragment}`
  }

  /** Resolve a media entry URL, falling back to its regular entry URL. */
  export function entryUrl(config: Config, meta: MediaEntryUrlMeta): string {
    const {data, defaultUrl, parentPaths, path, root, workspace} = meta
    const {extension, location} = data
    if (typeof extension !== 'string' || typeof location !== 'string')
      return defaultUrl
    return publicUrl(config, {
      extension,
      location,
      parentPaths,
      path,
      root,
      workspace
    })
  }
}
