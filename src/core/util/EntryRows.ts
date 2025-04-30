import {JsonLoader} from 'alinea/backend/loader/JsonLoader'
import type {Config} from '../Config.js'
import type {EntryStatus} from '../Entry.js'
import {createRecord} from '../EntryRecord.js'
import type {EntryRow} from '../EntryRow.js'
import {Type} from '../Type.js'
import {createFileHash, createRowHash} from './ContentHash.js'

export async function createEntryRow<T extends EntryRow>(
  config: Config,
  input: Omit<T, 'rowHash' | 'fileHash'>,
  status: EntryStatus
): Promise<T> {
  const record = createRecord(input, status)
  const fileContents = JsonLoader.format(config.schema, record)
  const fileHash = await createFileHash(fileContents)
  const rowHash = await createRowHash({...input, fileHash})
  const type = config.schema[input.type]
  const searchableText = Type.searchableText(type, input.data)
  return {...input, searchableText, fileHash, rowHash} as T
}
