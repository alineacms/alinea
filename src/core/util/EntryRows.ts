import {loaderFor} from '../Loader.js'
import type {Config} from '../Config.js'
import type {EntryStatus} from '../Entry.js'
import type {Entry} from '../Entry.js'
import {createRecord} from '../EntryRecord.js'
import {Type} from '../Type.js'
import {createFileHash, createRowHash} from './ContentHash.js'

export async function createEntryRow<T extends Entry>(
  config: Config,
  input: Omit<T, 'rowHash' | 'fileHash'>,
  status: EntryStatus
): Promise<T> {
  const record = createRecord(input, status)
  // Hash the file as it is written, in the format of the entry's own file
  const fileContents = loaderFor(input.filePath).format(config.schema, record)
  const fileHash = await createFileHash(fileContents)
  const rowHash = await createRowHash({...input, fileHash})
  const type = config.schema[input.type]
  const searchableText = Type.searchableText(type, input.data)
  return {...input, searchableText, fileHash, rowHash} as T
}
