import * as paths from '#/core/util/Paths.js'
import {Config} from '../Config.js'
import {
  ALT_STATUS,
  type Entry,
  type EntryStatus,
  entryStatuses
} from '../Entry.js'
import {getRoot, getType} from '../Internal.js'
import type {EntryUrlInput, Type} from '../Type.js'
import {Workspace} from '../Workspace.js'
import {assert} from './Assert.js'
import {join} from './Paths.js'

export function entryInfo(
  fileName: string
): [name: string, status: EntryStatus] {
  // See if filename ends in a known status
  const status = ALT_STATUS.find(s => fileName.endsWith(`.${s}`))
  if (status) return [fileName.slice(0, -status.length - 1), status]
  // Otherwise, it's published
  return [fileName, 'published']
}

/** The workspace/root/locale layout encoded in a source file path. */
export interface EntryFileLocation {
  workspace: string
  root: string
  locale: string | null
  path: string
  versionStatus: EntryStatus
  parentDir: string
  childrenDir: string
  /** Segments taken up by the workspace, root and locale. */
  levelOffset: number
  level: number
  parentPaths: Array<string>
}

/**
 * Read back the layout `Config.filePath` and `entryChildrenDir` write:
 * `[workspace/]root/[locale/]...parents/path[.status].json`.
 */
export function parseEntryFilePath(
  config: Config,
  filePath: string
): EntryFileLocation {
  const segments = filePath.split('/')
  const fileName = segments.at(-1)
  assert(fileName, `Invalid entry path: ${filePath}`)
  const extension = paths.extname(fileName)
  assert(extension, `Entry must have an extension: ${filePath}`)
  const [path, versionStatus] = entryInfo(paths.basename(fileName, extension))
  const parentDir = segments.slice(0, -1).join('/')
  let segmentIndex = 0
  const workspace = Config.multipleWorkspaces(config)
    ? segments[segmentIndex++]
    : Object.keys(config.workspaces)[0]
  assert(workspace, `Entry has no workspace: ${filePath}`)
  const workspaceConfig = config.workspaces[workspace]
  assert(workspaceConfig, `Invalid workspace: ${workspace} in ${filePath}`)
  const root = segments[segmentIndex++]
  assert(root, `Entry has no root: ${filePath}`)
  const rootConfig = workspaceConfig[root]
  assert(rootConfig, `Invalid root: ${root} for workspace ${workspace}`)
  const i18n = getRoot(rootConfig).i18n
  let locale: string | null = null
  if (i18n) {
    const segment = segments[segmentIndex++]
    assert(segment, `Entry is missing a locale: ${filePath}`)
    locale = segment.toLowerCase()
    for (const candidate of i18n.locales) {
      if (locale === candidate.toLowerCase()) {
        locale = candidate
        break
      }
    }
    assert(i18n.locales.includes(locale), `Invalid locale: ${locale}`)
  }
  const levelOffset = segmentIndex
  return {
    workspace,
    root,
    locale,
    path,
    versionStatus,
    parentDir,
    childrenDir: `${parentDir}/${path}`,
    levelOffset,
    level: segments.length - levelOffset - 1,
    parentPaths: segments.slice(levelOffset, -1)
  }
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

export function entryUrl(type: Type, meta: EntryUrlInput) {
  const segments = meta.locale ? [meta.locale.toLowerCase()] : []
  const defaultUrl = `/${segments
    .concat(
      meta.parentPaths
        .concat(meta.path)
        .filter(segment => segment !== 'index' && segment !== '')
    )
    .join('/')}`
  const {entryUrl} = getType(type)
  return entryUrl ? entryUrl({...meta, defaultUrl}) : defaultUrl
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
