import {JsonLoader} from '#/backend/loader/JsonLoader.js'
import type {Config} from '../Config.js'
import type {EntryStatus} from '../Entry.js'
import type {Entry} from '../Entry.js'
import {createRecord} from '../EntryRecord.js'
import {Type} from '../Type.js'
import {hashBlob} from '../source/GitUtils.js'
import {createRowHash} from './ContentHash.js'

export async function createEntryRow<T extends Entry>(
  config: Config,
  input: Omit<T, 'rowHash' | 'fileHash'>,
  status: EntryStatus
): Promise<T> {
  const record = createRecord(input, status)
  const fileContents = JsonLoader.format(config.schema, record)
  // As indexed rows are: by the git blob sha of their file, which trees
  // built over a preview hold
  const fileHash = await hashBlob(fileContents)
  const rowHash = await createRowHash({...input, fileHash})
  const type = config.schema[input.type]
  const searchableText = Type.searchableText(type, input.data)
  return {...input, searchableText, fileHash, rowHash} as T
}
