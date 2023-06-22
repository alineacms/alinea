import {boolean, object, string} from 'cito'
import {EntryRow} from './EntryRow.js'

export type EntryMeta = typeof EntryMeta.infer
export const EntryMeta = object(
  class {
    index = string
    root? = string.optional
    seeded? = boolean.optional
    i18n? = object({id: string}).optional
  }
)

// The data structure as stored in json files on disk
export type EntryRecord = typeof EntryRecord.infer & {
  [field: string]: any
}
export const EntryRecord = object(
  class {
    id = string
    type = string
    title = string.optional
    alinea = EntryMeta
    // ... fields
  }
)

export function createRecord(entry: EntryRow): EntryRecord {
  const {path, ...data} = entry.data
  const meta: EntryMeta = {index: entry.index}
  if (entry.seeded) meta.seeded = entry.seeded
  if (entry.i18nId) meta.i18n = {id: entry.i18nId}
  if (!entry.parent) meta.root = entry.root
  return {
    id: entry.entryId,
    type: entry.type,
    title: entry.title,
    ...data,
    alinea: meta
  }
}
