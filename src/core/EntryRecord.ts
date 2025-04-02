import type {EntryRow} from './EntryRow.js'

export interface EntryMeta {
  _id: string
  _type: string
  _index: string
  _root?: string
  _seeded?: string
}

// The data structure as stored in json files on disk
export interface EntryRecord extends EntryMeta {
  [field: string]: unknown
}

export namespace EntryRecord {
  export const id = '_id' satisfies keyof EntryMeta
  export const type = '_type' satisfies keyof EntryMeta
  export const index = '_index' satisfies keyof EntryMeta
  export const root = '_root' satisfies keyof EntryMeta
  export const seeded = '_seeded' satisfies keyof EntryMeta
}

export interface RequiredEntryFields extends Partial<EntryRow> {
  id: string
  type: string
  index: string
  data: Record<string, any>
}

export function parseRecord(record: EntryRecord) {
  const {
    [EntryRecord.id]: id,
    [EntryRecord.type]: type,
    [EntryRecord.index]: index,
    _i18nId: i18nId,
    [EntryRecord.root]: root,
    [EntryRecord.seeded]: seeded,
    ...data
  } = record
  return {
    meta: {
      id: (i18nId as string) ?? id,
      type,
      index,
      root,
      seeded
    },
    data,
    v0Id: typeof i18nId === 'string' ? id : undefined
  }
}

export function createRecord(entry: RequiredEntryFields): EntryRecord {
  const {path = entry.path, title = entry.title, ...data} = entry.data
  const id = entry.id
  const meta: EntryRecord = {
    [EntryRecord.id]: id,
    [EntryRecord.type]: entry.type,
    [EntryRecord.index]: entry.index
  }
  if (entry.seeded) meta[EntryRecord.seeded] = entry.seeded
  if (!entry.parentId) meta[EntryRecord.root] = entry.root
  const result = {
    ...meta,
    title,
    path,
    ...data
  } as EntryRecord
  if (path !== entry.path) result.path = path
  return result
}
