import {JsonLoader} from 'alinea/backend/loader/JsonLoader'
import {Config} from '../Config.js'
import {createRecord} from '../EntryRecord.js'
import {EntryPhase, EntryRow} from '../EntryRow.js'
import {Root} from '../Root.js'
import {EntryUrlMeta, Type} from '../Type.js'
import {createFileHash, createRowHash} from './ContentHash.js'
import {entryFilepath, entryInfo, entryUrl} from './EntryFilenames.js'
import * as paths from './Paths.js'

export async function createEntryRow<T extends EntryRow>(
  config: Config,
  input: Omit<T, 'rowHash' | 'fileHash'>
): Promise<T> {
  const record = createRecord(input)
  const fileContents = JsonLoader.format(config.schema, record)
  const fileHash = await createFileHash(fileContents)
  const rowHash = await createRowHash({...input, fileHash})
  const type = config.schema[input.type]
  const searchableText = Type.searchableText(type, input.data)
  return {...input, searchableText, fileHash, rowHash} as T
}

export function entryParentPaths(
  config: Config,
  entry: EntryRow
): Array<string> {
  const root = Root.data(config.workspaces[entry.workspace][entry.root])
  return entry.parentDir
    .split('/')
    .filter(Boolean)
    .slice(root.i18n ? 1 : 0)
}

export function publishEntryRow(config: Config, entry: EntryRow): EntryRow {
  const path = entry.data.path
  const parentPaths = entryParentPaths(config, entry)
  const filePath = entryFilepath(
    config,
    {
      ...entry,
      path,
      phase: EntryPhase.Published
    },
    parentPaths
  )
  const parentDir = paths.dirname(filePath)
  const extension = paths.extname(filePath)
  const fileName = paths.basename(filePath, extension)
  const [entryPath] = entryInfo(fileName)
  const childrenDir = paths.join(parentDir, entryPath)
  const urlMeta: EntryUrlMeta = {
    locale: entry.locale,
    path,
    phase: entry.phase,
    parentPaths
  }
  const url = entryUrl(config.schema[entry.type], urlMeta)
  return {
    ...entry,
    phase: EntryPhase.Published,
    path,
    filePath,
    parentDir,
    childrenDir,
    url
  }
}
