import {EntryRow} from './EntryRow.js'

export const META_KEY = '@alinea'

export interface EntryMeta {
  _id: string
  _type: string
  _index: string
  _i18nId?: string
  _root?: string
  _seeded?: string
}

// The data structure as stored in json files on disk
export interface EntryRecord extends EntryMeta {
  [field: string]: unknown
  [META_KEY]?: OldMeta
}

export namespace EntryRecord {
  export const id = '_id' satisfies keyof EntryRecord
  export const type = '_type' satisfies keyof EntryRecord
  export const index = '_index' satisfies keyof EntryRecord
  export const i18nId = '_i18nId' satisfies keyof EntryRecord
  export const root = '_root' satisfies keyof EntryRecord
  export const seeded = '_seeded' satisfies keyof EntryRecord
}

interface OldMeta {
  entryId: string
  type: string
  index: string
  i18nId?: string
  root?: string
  seeded?: string
}

export interface RequiredEntryFields extends Partial<EntryRow> {
  entryId: string
  type: string
  index: string
  data: Record<string, any>
}

export function parseRecord(record: EntryRecord) {
  const oldest = record.alinea as any
  const {
    [META_KEY]: old,
    [EntryRecord.id]: entryId = old?.entryId! ?? record.id,
    [EntryRecord.type]: type = old?.type! ?? record.type,
    [EntryRecord.index]: index = old?.index! ?? oldest?.index,
    [EntryRecord.i18nId]: i18nId = old?.i18nId! ?? oldest?.i18nId,
    [EntryRecord.root]: root = old?.root! ?? oldest?.root,
    [EntryRecord.seeded]: seeded = (old?.seeded as string) ?? oldest?.seeded,
    ...data
  } = record
  return {
    meta: {
      entryId,
      type,
      index,
      i18nId,
      root,
      seeded
    },
    data
  }
}

export function createRecord(entry: RequiredEntryFields): EntryRecord {
  const {path = entry.path, title = entry.title, ...data} = entry.data
  const meta: EntryRecord = {
    [EntryRecord.id]: entry.entryId,
    [EntryRecord.type]: entry.type,
    [EntryRecord.index]: entry.index,
    [EntryRecord.i18nId]: entry.i18nId
  }
  if (entry.seeded) meta[EntryRecord.seeded] = entry.seeded
  if (entry.locale && entry.i18nId) meta[EntryRecord.i18nId] = entry.i18nId
  if (!entry.parent) meta[EntryRecord.root] = entry.root
  return {
    ...meta,
    title,
    // path,
    ...data
  } as EntryRecord
}
