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

/** One complete authored entry version. JSON is stored as SQLite text. */
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
    url: column.varchar(undefined, {length: 1024}).notNull(),
    active: column.boolean().notNull(),
    main: column.boolean().notNull(),
    visible: column.boolean().notNull(),
    seeded: column.text(),
    rowHash: column.varchar(undefined, {length: 128}).notNull(),
    /** Precomputed hashes for reconstructing the logical index tree. */
    parentSha: column.varchar(undefined, {length: 128}),
    childrenSha: column.varchar(undefined, {length: 128}),
    data: column.json<Record<string, unknown>>().notNull(),
    source: column.json<EntrySource>()
  },
  row => ({
    byId: index().on(row.id, row.locale, row.versionStatus),
    byUrl: index().on(row.url),
    byType: index().on(row.type),
    byParent: index().on(row.parentId, row.locale, row.index),
    byLocation: index().on(row.workspace, row.root, row.status, row.index)
  })
)

export const sourceFields = [
  'filePath',
  'fileHash',
  'parentDir',
  'childrenDir',
  'searchableText'
] as const

/** Normalized source metadata travels with the authorized entry payload. */
export interface EntrySource extends Partial<
  Pick<Entry, (typeof sourceFields)[number]>
> {}

export function entrySource(entry: Entry): EntrySource {
  return Object.fromEntries(sourceFields.map(name => [name, entry[name]]))
}

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
  /** False for authored versions suppressed by inherited status in normal queries. */
  visible?: boolean
  /** Stable source insertion order for equal fractional positions. */
  ordinal?: number
  /** First source-directory segment below the content root (not the URL slug). */
  sourceRoot?: string | null
  /** Logical parent directory hash, or the index root for top-level rows. */
  parentSha?: string | null
  /** Directory hash covering this identity's versions and children. */
  childrenSha?: string | null
}

export function entryIndexRow(
  entry: IndexedEntry & Partial<Pick<Entry, 'parentDir'>>,
  data: Record<string, unknown> = {},
  source?: EntrySource
) {
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
      (entry.level > 0 ? entry.parentDir?.split('/').at(-entry.level) : null),
    parentId: entry.parentId,
    parents: entry.parents,
    level: entry.level,
    index: entry.index,
    ordinal: entry.ordinal ?? 0,
    path: entry.path,
    url: entry.url,
    active: entry.active,
    main: entry.main,
    visible: entry.visible ?? true,
    seeded: entry.seeded,
    rowHash: entry.rowHash,
    parentSha: entry.parentSha ?? null,
    childrenSha: entry.childrenSha ?? null,
    data,
    source: source ?? null
  }
}
