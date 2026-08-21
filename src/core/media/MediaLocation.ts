import type {Config} from '../Config.js'
import {Workspace} from '../Workspace.js'
import {join, normalize} from '../util/Paths.js'
import {joinPaths} from '../util/Urls.js'

export const MEDIA_LOCATION = '@alinea.location'

export interface MediaUrlMeta {
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

export interface MediaUrlResolver {
  (meta: MediaUrlMeta): string
}

export interface MediaPublicUrlMeta extends Omit<MediaUrlMeta, 'parentPaths'> {
  entryUrl: string
}

export interface MediaEntryUrlMeta {
  entryUrl: string
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
    const prefix = normalize(mediaDir).replace(/\/$/, '')
    if (location === prefix) return ''
    return location.startsWith(`${prefix}/`)
      ? location.slice(prefix.length)
      : location
  }

  /** Resolve the public URL used to serve a media entry. */
  export function publicUrl(config: Config, meta: MediaPublicUrlMeta): string {
    const {entryUrl, ...media} = meta
    const {location, workspace} = media
    const {mediaUrl} = Workspace.data(config.workspaces[workspace])
    if (!mediaUrl) return location
    if (typeof mediaUrl === 'function') {
      const segments = entryUrl.split('/').filter(Boolean)
      return mediaUrl({
        ...media,
        parentPaths: segments.slice(0, -1)
      })
    }
    return joinPaths(mediaUrl, location)
  }

  /** Resolve a media entry URL, falling back to its regular entry URL. */
  export function entryUrl(config: Config, meta: MediaEntryUrlMeta): string {
    const {data, entryUrl, path, root, workspace} = meta
    const {extension, location} = data
    if (typeof extension !== 'string' || typeof location !== 'string')
      return entryUrl
    return publicUrl(config, {
      entryUrl,
      extension,
      location,
      path,
      root,
      workspace
    })
  }
}
