import {boolean, object, string} from 'cito'
import {EntryRow} from './EntryRow.js'

export const META_KEY = '@alinea'

export type EntryMeta = typeof EntryMeta.infer
export const EntryMeta = object(
  class {
    entryId = string
    i18nId? = string.optional
    type = string
    index = string
    root? = string.optional
    seeded? = boolean.optional
  }
)

// The data structure as stored in json files on disk
export type EntryRecord = typeof EntryRecord.infer & {
  [field: string]: unknown
}
export const EntryRecord = object(
  class {
    title = string.optional;
    [META_KEY] = EntryMeta
    // ... fields
  }
)

export function createRecord(entry: EntryRow): EntryRecord {
  const {path, ...data} = entry.data
  const meta: EntryMeta = {
    entryId: entry.entryId,
    type: entry.type,
    index: entry.index
  }
  if (entry.seeded) meta.seeded = entry.seeded
  if (entry.locale && entry.i18nId) meta.i18nId = entry.i18nId
  if (!entry.parent) meta.root = entry.root
  return {
    title: entry.title,
    ...data,
    [META_KEY]: meta
  }
}
