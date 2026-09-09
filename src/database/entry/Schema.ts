import type {Entry, EntryStatus} from '#/core/Entry.js'
import {index, table} from 'rado'
import * as column from 'rado/universal/columns'

export function entryVersionId(
  id: string,
  locale: string | null,
  status: EntryStatus
): string {
  return JSON.stringify([id, locale?.toLowerCase() ?? null, status])
}

/** Structural metadata is fully resident, including in browser replicas. */
export const EntryIndexTable = table(
  'alinea_entry_index',
  {
    versionId: column.varchar(undefined, {length: 255}).primaryKey(),
    id: column.varchar(undefined, {length: 128}).notNull(),
    locale: column.varchar(undefined, {length: 64}),
    versionStatus: column
      .varchar(undefined, {length: 16})
      .notNull()
      .$type<EntryStatus>(),
    status: column
      .varchar(undefined, {length: 16})
      .notNull()
      .$type<EntryStatus>(),
    type: column.varchar(undefined, {length: 255}).notNull(),
    title: column.text().notNull(),
    workspace: column.varchar(undefined, {length: 255}).notNull(),
    root: column.varchar(undefined, {length: 255}).notNull(),
    parentId: column.varchar(undefined, {length: 128}),
    parents: column.json<Array<string>>().notNull(),
    level: column.integer().notNull(),
    index: column.varchar(undefined, {length: 255}).notNull(),
    ordinal: column.integer().notNull(),
    path: column.text().notNull(),
    url: column.varchar(undefined, {length: 1024}).notNull(),
    active: column.boolean().notNull(),
    main: column.boolean().notNull(),
    seeded: column.text(),
    rowHash: column.varchar(undefined, {length: 128}).notNull()
  },
  row => ({
    byId: index().on(row.id, row.locale, row.versionStatus),
    byUrl: index().on(row.url),
    byType: index().on(row.type),
    byParent: index().on(row.parentId, row.locale, row.index),
    byLocation: index().on(row.workspace, row.root, row.status, row.index)
  })
)

/** Absence means unhydrated; empty JSON is a real, resident payload. */
export const EntryDataTable = table('alinea_entry_data', {
  versionId: column.varchar(undefined, {length: 255}).primaryKey(),
  payloadId: column.varchar(undefined, {length: 255}).notNull(),
  data: column.json<Record<string, unknown>>().notNull()
})

export interface IndexedEntry extends Omit<
  Entry,
  | 'data'
  | 'searchableText'
  | 'filePath'
  | 'fileHash'
  | 'parentDir'
  | 'childrenDir'
> {
  versionStatus: EntryStatus
  /** Stable source insertion order for equal fractional positions. */
  ordinal?: number
}

export function entryIndexRow(entry: IndexedEntry) {
  return {
    versionId: entryVersionId(entry.id, entry.locale, entry.versionStatus),
    id: entry.id,
    locale: entry.locale?.toLowerCase() ?? null,
    versionStatus: entry.versionStatus,
    status: entry.status,
    type: entry.type,
    title: entry.title,
    workspace: entry.workspace,
    root: entry.root,
    parentId: entry.parentId,
    parents: entry.parents,
    level: entry.level,
    index: entry.index,
    ordinal: entry.ordinal ?? 0,
    path: entry.path,
    url: entry.url,
    active: entry.active,
    main: entry.main,
    seeded: entry.seeded,
    rowHash: entry.rowHash
  }
}
