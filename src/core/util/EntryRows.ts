import {JsonLoader} from 'alinea/backend'
import {createFileHash, createRowHash} from 'alinea/backend/util/ContentHash'
import {Config} from '../Config.js'
import {createRecord} from '../EntryRecord.js'
import {EntryRow} from '../EntryRow.js'

export async function createEntryRow<T extends EntryRow>(
  config: Config,
  input: Omit<T, 'rowHash' | 'fileHash'>
): Promise<T> {
  const record = createRecord(input)
  const fileContents = JsonLoader.format(config.schema, record)
  const fileHash = await createFileHash(fileContents)
  const rowHash = await createRowHash({...input, fileHash})
  return {...input, fileHash, rowHash} as T
}
