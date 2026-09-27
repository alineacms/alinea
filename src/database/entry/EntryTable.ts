import type {Config} from '#/core/Config.js'
import type {Entry, EntryStatus} from '#/core/Entry.js'
import {
  createRecord,
  parseRecord,
  type EntryRecord
} from '#/core/EntryRecord.js'
import {Type} from '#/core/Type.js'
import {assert} from '#/core/util/Assert.js'
import {isRecord} from '#/core/util/Objects.js'
import {DateField} from '#/field/date/DateField.js'
import {NumberField} from '#/field/number/NumberField.js'
import {index, primaryKey, sql, table, type Database, type Table} from 'rado'
import * as column from 'rado/universal/columns'
import {jsonField} from '../query/Condition.js'

function entryVersionId(
  id: string,
  locale: string | null,
  status: EntryStatus
): string {
  return JSON.stringify([id, locale?.toLowerCase() ?? null, status])
}

/** One complete authored entry version. Only arrays and authored data are JSON. */
export const EntryIndexColumns = {
  /**
   * Also the rowid of the version's full-text search row. Declared, so VACUUM
   * keeps it.
   */
  rowid: column.integer().primaryKey(),
  versionId: column.varchar(undefined, {length: 255}).notNull().unique(),
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
  /** Exact source blob for seeded rows whose expanded data differs. */
  payload: column.text(),
  /**
   * Exact source JSON, or expanded JSON for seeded rows. Stored as JSONB where
   * SQLite supports it; read it as text with `entryDataText`.
   */
  data: column.text().notNull()
}

export function entryIndexTable(name: string) {
  return table(name, EntryIndexColumns, row => [
    index(`${name}_by_id`).on(row.id, row.locale, row.versionStatus),
    index(`${name}_by_url`).on(row.url),
    index(`${name}_by_type`).on(row.type, row.locale, row.workspace),
    index(`${name}_by_parent`).on(row.parentId, row.locale, row.index),
    index(`${name}_by_children_dir`).on(row.childrenDir),
    index(`${name}_by_location`).on(
      row.workspace,
      row.root,
      row.status,
      row.index
    ),
    index(`${name}_by_file_path`).on(row.filePath),
    index(`${name}_by_seed`).on(row.seeded, row.workspace, row.root, row.locale)
  ])
}

export type EntryIndexTarget = Table<typeof EntryIndexColumns>

export const EntryIndexTable = entryIndexTable('alinea_entry_index')

/** The entry ids each entry version references, under the version's rowid. */
export const EntryReferenceTable = table(
  'alinea_entry_reference',
  {
    targetId: column.varchar(undefined, {length: 128}).notNull(),
    source: column.integer().notNull()
  },
  row => [
    primaryKey(row.targetId, row.source),
    index('alinea_entry_reference_by_source').on(row.source)
  ]
)

/** Fields whose queries order by their stored value, through a field index. */
export function isOrderedField(field: unknown): boolean {
  return field instanceof DateField || field instanceof NumberField
}

const fieldIndexPrefix = 'alinea_entry_index_by_field_'

/** Index the stored value of every ordered field in the config, per type. */
export async function syncFieldIndexes(
  db: Database,
  config: Config
): Promise<void> {
  const wanted = new Set<string>()
  for (const type of Object.values(config.schema))
    for (const [name, field] of Object.entries(Type.fields(type)))
      if (isOrderedField(field)) wanted.add(name)
  const rows = await db.all<{name: string}>(
    sql`select name from sqlite_master where type = 'index'`
  )
  const existing = new Set<string>()
  for (const {name} of rows)
    if (name.startsWith(fieldIndexPrefix))
      existing.add(name.slice(fieldIndexPrefix.length))
  for (const name of existing)
    if (!wanted.has(name))
      await db.run(sql`drop index ${sql.identifier(fieldIndexPrefix + name)}`)
  for (const name of wanted) {
    if (existing.has(name)) continue
    // Index expressions cannot name their table, but match the queries'
    // qualified column all the same.
    const value = jsonField(sql.identifier('data'), [name])
    await db.run(sql`create index ${sql.identifier(fieldIndexPrefix + name)}
      on ${EntryIndexTable}(${sql.identifier('type')}, ${value},
        ${sql.identifier('index')}, ${sql.identifier('filePath')})`)
  }
}

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
  const payload =
    entry.payload ??
    JSON.stringify(createRecord(entry, entry.versionStatus), null, 2)
  return {
    versionId: entryVersionId(entry.id, entry.locale, entry.versionStatus),
    id: entry.id,
    locale: entry.locale,
    versionStatus: entry.versionStatus,
    status: entry.status,
    type: entry.type,
    title: entry.title,
    workspace: entry.workspace,
    root: entry.root,
    sourceRoot:
      entry.sourceRoot ??
      (entry.level > 0
        ? (entry.parentDir.split('/').at(-entry.level) ?? null)
        : null),
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
    payload: entry.seeded ? payload : null,
    data: entry.seeded ? JSON.stringify(entry.data) : payload
  }
}

export function storedEntryData(
  value: unknown,
  path: string
): Record<string, unknown> {
  const raw = typeof value === 'string' ? JSON.parse(value) : value
  assert(isRecord(raw), 'Invalid stored entry data')
  const {data} = parseRecord(raw as EntryRecord)
  return {path, ...data}
}
