import {JsonLoader} from 'alinea/backend'
import {Config} from './Config.js'
import {EntryPhase, EntryRow} from './EntryRow.js'
import {Workspace} from './Workspace.js'
import {values} from './util/Objects.js'
import {join} from './util/Paths.js'

const ALT_STATUS = [EntryPhase.Draft, EntryPhase.Archived]

export function entryInfo(
  fileName: string
): [name: string, status: EntryPhase] {
  // See if filename ends in a known status
  const status = ALT_STATUS.find(s => fileName.endsWith(`.${s}`))
  if (status) return [fileName.slice(0, -status.length - 1), status]
  // Otherwise, it's published
  return [fileName, EntryPhase.Published]
}

export function entryFileName(
  config: Config,
  entry: EntryRow,
  parentPaths: Array<string>
): string {
  const workspace = config.workspaces[entry.workspace]
  if (!workspace)
    throw new Error(`Workspace "${entry.workspace}" does not exist`)
  const {source: contentDir} = Workspace.data(workspace)
  const root = Workspace.roots(workspace)[entry.root]
  if (!root) throw new Error(`Root "${entry.root}" does not exist`)
  const hasI18n = Boolean(root.i18n)
  const {locale, path, phase} = entry
  if (hasI18n && !locale) throw new Error(`Entry is missing locale`)
  if (!values(EntryPhase).includes(phase))
    throw new Error(`Entry has unknown phase: ${phase}`)
  const segments = (locale ? [locale] : [])
    .concat(
      parentPaths
        .concat(path)
        .map(segment => (segment === '' ? 'index' : segment))
    )
    .join('/')
  const phaseSegment = phase === EntryPhase.Published ? '' : `.${phase}`
  const location = (
    segments +
    phaseSegment +
    JsonLoader.extension
  ).toLowerCase()
  return join(contentDir, entry.root, location)
}
