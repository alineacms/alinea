import {object, string} from 'cito'
import {Entry} from './Entry.js'

export type EntryMeta = typeof EntryMeta.infer
export const EntryMeta = object(
  class {
    index = string
    root? = string.optional
    i18n? = object({id: string}).optional
  }
)

// The data structure as stored in json files on disk
export type EntryRecord = typeof EntryRecord.infer
export const EntryRecord = object(
  class {
    id = string
    type = string
    title = string
    alinea = EntryMeta
    // ... fields
  }
)

export function createRecord(entry: Entry): EntryRecord {
  const meta: EntryMeta = {index: entry.index}
  if (entry.i18nId) meta.i18n = {id: entry.i18nId}
  if (!entry.parent) meta.root = entry.root
  return {
    id: entry.entryId,
    type: entry.type,
    title: entry.title,
    ...entry.data,
    alinea: meta
  }
}
