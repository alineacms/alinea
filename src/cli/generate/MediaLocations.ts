import * as fsp from 'node:fs/promises'
import path from 'node:path'
import {Config} from '#/core/Config.js'
import {Entry, type EntryStatus} from '#/core/Entry.js'
import {MediaLocation} from '#/core/media/MediaLocation.js'
import {FileData} from '#/core/media/MediaTypes.js'
import {basename, join} from '#/core/util/Paths.js'
import type {EntryStore} from '#/database/EntryStore.js'

export interface RemoteLocation {
  id: string
  locale: string | null
  status: EntryStatus
  workspace: string
  /** The content file of the media entry */
  file: string
  location: string
  /** The location of the one file with the same name in the mediaDir */
  local?: string
}

/**
 * Media entries whose location is a url. Only the 1.x dashboard wrote those
 * (upload urls belong in previewUrl), they can't be served from the site.
 */
export async function remoteLocations(
  rootDir: string,
  db: EntryStore
): Promise<Array<RemoteLocation>> {
  const {config} = db
  const files = await db.find({
    type: Config.fileTypes(config),
    status: 'all',
    select: {
      id: Entry.id,
      locale: Entry.locale,
      status: Entry.versionStatus,
      workspace: Entry.workspace,
      filePath: Entry.filePath,
      location: FileData.location
    }
  })
  const remote = files.filter(
    file =>
      typeof file.location === 'string' && /^https?:\/\//i.test(file.location)
  )
  const listings = new Map<string, Promise<Array<string>>>()
  const result = Array<RemoteLocation>()
  for (const file of remote) {
    const mediaDir = MediaLocation.directory(config, file.workspace)
    let listing = listings.get(mediaDir)
    if (!listing)
      listings.set(mediaDir, (listing = listFiles(join(rootDir, mediaDir))))
    const name = fileName(file.location)
    const matches = (await listing).filter(path => basename(path) === name)
    result.push({
      id: file.id,
      locale: file.locale,
      status: file.status,
      workspace: file.workspace,
      file: join(Config.contentDir(config), file.filePath),
      location: file.location,
      local:
        matches.length === 1
          ? MediaLocation.entryLocation(
              config,
              file.workspace,
              join(mediaDir, matches[0])
            )
          : undefined
    })
  }
  return result
}

function fileName(url: string) {
  const {pathname} = new URL(url)
  try {
    return decodeURIComponent(basename(pathname))
  } catch {
    return basename(pathname)
  }
}

async function listFiles(dir: string): Promise<Array<string>> {
  const entries = await fsp
    .readdir(dir, {recursive: true, withFileTypes: true})
    .catch(() => [])
  return entries
    .filter(entry => entry.isFile())
    .map(entry =>
      path
        .relative(dir, path.join(entry.parentPath, entry.name))
        .split(path.sep)
        .join('/')
    )
}
