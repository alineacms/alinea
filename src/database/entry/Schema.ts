import type {Entry, EntryStatus} from '#/core/Entry.js'
import {index, table} from 'rado'
import * as column from 'rado/universal/columns'

/** Leave integer insertion slots for request-local authored versions. */
export const entryOrdinalStep = 1024

export function entryVersionId(
  id: string,
  locale: string | null,
  status: EntryStatus
): string {
  return JSON.stringify([id, locale?.toLowerCase() ?? null, status])
}

/** One complete authored entry version. Only arrays and authored data are JSON. */
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
    sourceRoot: column.varchar(undefined, {length: 255}),
    parentId: column.varchar(undefined, {length: 128}),
    parents: column.json<Array<string>>().notNull(),
    level: column.integer().notNull(),
    index: column.varchar(undefined, {length: 255}).notNull(),
    ordinal: column.integer().notNull(),
    path: column.text().notNull(),
    /** Full source path of this authored version. */
    filePath: column.text().notNull(),
    fileHash: column.varchar(undefined, {length: 128}).notNull(),
    parentDir: column.text().notNull(),
    childrenDir: column.text().notNull(),
    url: column.varchar(undefined, {length: 1024}).notNull(),
    active: column.boolean().notNull(),
    main: column.boolean().notNull(),
    visible: column.boolean().notNull(),
    seeded: column.text(),
    rowHash: column.varchar(undefined, {length: 128}).notNull(),
    /** Cached logical-directory hash for no-hash client tree reconstruction. */
    childrenSha: column.varchar(undefined, {length: 128}),
    searchableText: column.text().notNull(),
    data: column.json<Record<string, unknown>>().notNull()
  },
  row => ({
    byId: index().on(row.id, row.locale, row.versionStatus),
    byUrl: index().on(row.url),
    byType: index().on(row.type),
    byParent: index().on(row.parentId, row.locale, row.index),
    byLocation: index().on(row.workspace, row.root, row.status, row.index),
    byFilePath: index().on(row.filePath)
  })
)

/** An Entry plus the physical-version and local-index fields. */
export interface IndexedEntry extends Entry {
  versionStatus: EntryStatus
  /** False for authored versions suppressed by inherited status in normal queries. */
  visible?: boolean
  /** Stable source insertion order for equal fractional positions. */
  ordinal?: number
  /** First source-directory segment below the content root (not the URL slug). */
  sourceRoot?: string | null
  /** Cached logical-directory hash for no-hash client tree reconstruction. */
  childrenSha?: string | null
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
    sourceRoot:
      entry.sourceRoot ??
      (entry.level > 0 ? entry.parentDir.split('/').at(-entry.level) : null),
    parentId: entry.parentId,
    parents: entry.parents,
    level: entry.level,
    index: entry.index,
    ordinal: entry.ordinal ?? 0,
    path: entry.path,
    filePath: entry.filePath,
    fileHash: entry.fileHash,
    parentDir: entry.parentDir,
    childrenDir: entry.childrenDir,
    url: entry.url,
    active: entry.active,
    main: entry.main,
    visible: entry.visible ?? true,
    seeded: entry.seeded,
    rowHash: entry.rowHash,
    childrenSha: entry.childrenSha ?? null,
    searchableText: entry.searchableText,
    data: entry.data
  }
}
