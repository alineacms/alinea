import * as paths from '#/core/util/Paths.js'
import type {Config} from '../Config.js'
import {
  ALT_STATUS,
  type Entry,
  type EntryStatus,
  entryStatuses
} from '../Entry.js'
import {getRoot, getType} from '../Internal.js'
import type {EntryUrlMeta, Type} from '../Type.js'
import {Workspace} from '../Workspace.js'
import {join} from './Paths.js'
import {joinPaths} from './Urls.js'

export function workspaceMediaDir(config: Config, workspace: string): string {
  return Workspace.data(config.workspaces[workspace])?.mediaDir ?? ''
}

export function mediaLocationUrl(
  config: Config,
  workspace: string,
  location: string
): string {
  const {mediaDir, mediaUrl: configuredUrl} = Workspace.data(
    config.workspaces[workspace]
  )
  let mediaUrl = configuredUrl
  if (mediaUrl === undefined && mediaDir) {
    const publicDir = config.publicDir ?? '/public'
    const publicRelative = paths.relative(publicDir, mediaDir)
    const inPublicDir =
      publicRelative &&
      !publicRelative.startsWith('..') &&
      !paths.isAbsolute(publicRelative)
    if (publicRelative === '') mediaUrl = ''
    else mediaUrl = join('/', inPublicDir ? publicRelative : mediaDir)
  }
  if (!mediaUrl) return location
  return joinPaths(mediaUrl, location)
}

export function entryInfo(
  fileName: string
): [name: string, status: EntryStatus] {
  // See if filename ends in a known status
  const status = ALT_STATUS.find(s => fileName.endsWith(`.${s}`))
  if (status) return [fileName.slice(0, -status.length - 1), status]
  // Otherwise, it's published
  return [fileName, 'published']
}

export function entryChildrenDir(
  config: Config,
  entry: {
    workspace: string
    root: string
    locale: string | null
    path: string
    status: EntryStatus
  },
  parentPaths: Array<string>
) {
  const workspace = config.workspaces[entry.workspace]
  if (!workspace)
    throw new Error(`Workspace "${entry.workspace}" does not exist`)
  const root = Workspace.roots(workspace)[entry.root]
  if (!root) throw new Error(`Root "${entry.root}" does not exist`)
  const hasI18n = getRoot(root).i18n
  const {locale, path, status} = entry
  if (hasI18n && !locale) throw new Error('Entry is missing locale')
  if (!entryStatuses.includes(status))
    throw new Error(`Entry has unknown phase: ${status}`)
  return `/${(locale ? [locale.toLowerCase()] : [])
    .concat(
      parentPaths
        .concat(path)
        .map(segment => (segment === '' ? 'index' : segment))
    )
    .join('/')}`
}

export function entryFilepath(
  config: Config,
  entry: {
    workspace: string
    root: string
    locale: string | null
    path: string
    status: EntryStatus
  },
  parentPaths: Array<string>
): string {
  const {status} = entry
  if (!entryStatuses.includes(status))
    throw new Error(`Entry has unknown phase: ${status}`)
  const statusSegment = status === 'published' ? '' : `.${status}`
  const location = `${
    entryChildrenDir(config, entry, parentPaths) + statusSegment
  }.json`.toLowerCase()
  const workspace = config.workspaces[entry.workspace]
  if (!workspace)
    throw new Error(`Workspace "${entry.workspace}" does not exist`)
  const root = Workspace.roots(workspace)[entry.root]
  if (!root) throw new Error(`Root "${entry.root}" does not exist`)
  return join(entry.root, location)
}

export function entryFileName(
  config: Config,
  entry: {
    workspace: string
    root: string
    locale: string | null
    path: string
    status: EntryStatus
  },
  parentPaths: Array<string>
): string {
  const workspace = config.workspaces[entry.workspace]
  if (!workspace)
    throw new Error(`Workspace "${entry.workspace}" does not exist`)
  const {source: contentDir} = Workspace.data(workspace)
  return join(contentDir, entryFilepath(config, entry, parentPaths))
}

export function entryFile(config: Config, entry: Entry) {
  const workspace = config.workspaces[entry.workspace]
  if (!workspace)
    throw new Error(`Workspace "${entry.workspace}" does not exist`)
  const filePath = entry.filePath
  const {source: contentDir} = Workspace.data(workspace)
  const root = Workspace.roots(workspace)[entry.root]
  if (!root) throw new Error(`Root "${entry.root}" does not exist`)
  return join(contentDir, entry.root, filePath)
}

export function entryUrl(type: Type, meta: EntryUrlMeta) {
  const {entryUrl} = getType(type)
  if (entryUrl) return entryUrl(meta)
  const segments = meta.locale ? [meta.locale.toLowerCase()] : []
  return `/${segments
    .concat(
      meta.parentPaths
        .concat(meta.path)
        .filter(segment => segment !== 'index' && segment !== '')
    )
    .join('/')}`
}

export function pathSuffix(
  path: string,
  conflictingPaths: Array<string>
): number | undefined {
  if (conflictingPaths.includes(path)) {
    let suffix = 0
    while (true)
      if (!conflictingPaths.includes(`${path}-${++suffix}`)) return suffix
  }
}

export function applySuffix(path: string, suffix: number) {
  return `${path}-${suffix}`
}

export function fileVersions(file: string) {
  const dir = paths.dirname(file)
  const base = paths.basename(file, '.json')
  const [name] = entryInfo(base)
  return [
    `${dir}/${name}.json`,
    `${dir}/${name}.draft.json`,
    `${dir}/${name}.archived.json`
  ]
}
