import * as paths from 'alinea/core/util/Paths'
import type {Config} from '../Config.js'
import {type EntryStatus, entryStatuses} from '../Entry.js'
import {ALT_STATUS, type EntryRow} from '../EntryRow.js'
import {getRoot, getType} from '../Internal.js'
import type {EntryUrlMeta, Type} from '../Type.js'
import {Workspace} from '../Workspace.js'
import {join} from './Paths.js'

export function workspaceMediaDir(config: Config, workspace: string): string {
  return Workspace.data(config.workspaces[workspace])?.mediaDir ?? ''
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
  return location
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
  const root = Workspace.roots(workspace)[entry.root]
  if (!root) throw new Error(`Root "${entry.root}" does not exist`)
  return join(contentDir, entry.root, entryFilepath(config, entry, parentPaths))
}

export function entryFile(config: Config, entry: EntryRow) {
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
