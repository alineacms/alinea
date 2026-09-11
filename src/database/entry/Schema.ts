import type {Entry, EntryStatus} from '#/core/Entry.js'
import {createRecord} from '#/core/EntryRecord.js'
import type {Tree} from '#/core/source/Tree.js'
import {index, table, temporaryTable, type Table} from 'rado'
import * as column from 'rado/universal/columns'

export function entryVersionId(
  id: string,
  locale: string | null,
  status: EntryStatus
): string {
  return JSON.stringify([id, locale?.toLowerCase() ?? null, status])
}

/** One complete authored entry version. Only arrays and authored data are JSON. */
export const EntryIndexColumns = {
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
  /** Hash of this entry's child directory in the synced source tree. */
  childrenSha: column.varchar(undefined, {length: 128}),
  searchableText: column.text().notNull(),
  /** Exact source blob, kept as text so the database can act as a Source. */
  payload: column.text().notNull(),
  data: column.json<Record<string, unknown>>().notNull()
}

export function entryIndexTable(name: string, temporary = false) {
  const create = temporary ? temporaryTable : table
  return create(name, EntryIndexColumns, row => [
    index(`${name}_by_id`).on(row.id, row.locale, row.versionStatus),
    index(`${name}_by_url`).on(row.url),
    index(`${name}_by_type`).on(row.type),
    index(`${name}_by_parent`).on(row.parentId, row.locale, row.index),
    index(`${name}_by_children_dir`).on(row.childrenDir),
    index(`${name}_by_location`).on(
      row.workspace,
      row.root,
      row.status,
      row.index
    ),
    index(`${name}_by_file_path`).on(row.filePath)
  ])
}

export type EntryIndexTarget = Table<typeof EntryIndexColumns>

export const EntryIndexTable = entryIndexTable('alinea_entry_index')

export const DatabaseStateColumns = {
  id: column.integer().primaryKey(),
  revision: column.text().notNull(),
  /** Merkle tree matching the indexed source revision. */
  tree: column.json<Tree>()
}

export const DatabaseStateTable = table(
  'alinea_database_state',
  DatabaseStateColumns
)

export const DatabaseMetadataColumns = {
  id: column.integer().primaryKey(),
  schemaVersion: column.integer().notNull(),
  configFingerprint: column.text().notNull()
}

export const DatabaseMetadataTable = table(
  'alinea_database_metadata',
  DatabaseMetadataColumns
)

/** An Entry plus the physical-version and local-index fields. */
export interface IndexedEntry extends Entry {
  versionStatus: EntryStatus
  /** Exact source text matching fileHash. */
  payload?: string
  /** False for authored versions suppressed by inherited status in normal queries. */
  visible?: boolean
  /** First source-directory segment below the content root (not the URL slug). */
  sourceRoot?: string | null
  /** Hash of this entry's child directory in the synced source tree. */
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
    payload:
      entry.payload ??
      JSON.stringify(createRecord(entry, entry.versionStatus), null, 2),
    data: entry.data
  }
}
