import {JsonLoader} from 'alinea/backend'
import {Config} from './Config.js'
import {ALT_STATUS, EntryPhase, EntryRow} from './EntryRow.js'
import {Workspace} from './Workspace.js'
import {values} from './util/Objects.js'
import {join} from './util/Paths.js'

export function workspaceMediaDir(config: Config, workspace: string): string {
  return Workspace.data(config.workspaces[workspace])?.mediaDir ?? ''
}

export function entryInfo(
  fileName: string
): [name: string, status: EntryPhase] {
  // See if filename ends in a known status
  const status = ALT_STATUS.find(s => fileName.endsWith(`.${s}`))
  if (status) return [fileName.slice(0, -status.length - 1), status]
  // Otherwise, it's published
  return [fileName, EntryPhase.Published]
}

export function entryChildrenDir(
  config: Config,
  entry: {
    workspace: string
    root: string
    locale: string | null
    path: string
    phase: EntryPhase
  },
  parentPaths: Array<string>
) {
  const workspace = config.workspaces[entry.workspace]
  if (!workspace)
    throw new Error(`Workspace "${entry.workspace}" does not exist`)
  const root = Workspace.roots(workspace)[entry.root]
  if (!root) throw new Error(`Root "${entry.root}" does not exist`)
  const hasI18n = Boolean(root.i18n)
  const {locale, path, phase} = entry
  if (hasI18n && !locale) throw new Error(`Entry is missing locale`)
  if (!values(EntryPhase).includes(phase))
    throw new Error(`Entry has unknown phase: ${phase}`)
  return (
    '/' +
    (locale ? [locale] : [])
      .concat(
        parentPaths
          .concat(path)
          .map(segment => (segment === '' ? 'index' : segment))
      )
      .join('/')
  )
}

export function entryFilepath(
  config: Config,
  entry: {
    workspace: string
    root: string
    locale: string | null
    path: string
    phase: EntryPhase
  },
  parentPaths: Array<string>
): string {
  const {phase} = entry
  if (!values(EntryPhase).includes(phase))
    throw new Error(`Entry has unknown phase: ${phase}`)
  const phaseSegment = phase === EntryPhase.Published ? '' : `.${phase}`
  const location = (
    entryChildrenDir(config, entry, parentPaths) +
    phaseSegment +
    JsonLoader.extension
  ).toLowerCase()
  return location
}

export function entryFileName(
  config: Config,
  entry: {
    workspace: string
    root: string
    locale: string | null
    path: string
    phase: EntryPhase
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
