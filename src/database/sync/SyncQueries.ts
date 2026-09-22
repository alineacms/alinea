import type {Tree} from '#/core/source/Tree.js'
import {
  alias,
  and,
  asc,
  Builder,
  count,
  eq,
  exists,
  gt,
  inArray,
  isNull,
  max,
  min,
  not,
  sql,
  temporaryTable,
  when,
  type Database,
  type Sql
} from 'rado'
import * as column from 'rado/universal/columns'
import {
  EntryIndexColumns,
  type entryIndexRow,
  type IndexedEntry
} from '../entry/EntryTable.js'
import type {EntrySyncTarget} from './EntrySyncer.js'

export const sqliteBatchSize = 5000

export const SyncAffected = temporaryTable('alinea_sync_affected', {
  id: column.text().primaryKey()
})

export const SyncCascade = temporaryTable('alinea_sync_cascade', {
  id: column.text().primaryKey()
})

export const SyncValues = temporaryTable('alinea_sync_values', {
  key: column.text().primaryKey(),
  value: column.text().notNull()
})

export const SyncStatus = temporaryTable('alinea_sync_status', {
  key: column.text().primaryKey(),
  effectiveStatus: column.text().$type<string | null>(),
  activeStatus: column.text().notNull(),
  mainStatus: column.text().notNull()
})

/** One key/value pair staged in the temporary {@link SyncValues} table. */
export interface SyncValueRow {
  key: string
  value: string
}

const builder = new Builder()
const afterVersionId = sql.placeholder<string>('afterVersionId')
const level = sql.placeholder<number>('level')
const revision = sql.placeholder<string>('revision')
const treeSnapshot = sql.placeholder<string | null>('tree')
function revisionQuery(target: EntrySyncTarget) {
  const DatabaseState = target.state
  return builder
    .select({revision: DatabaseState.revision, tree: DatabaseState.tree})
    .from(DatabaseState)
    .where(eq(DatabaseState.id, 1))
    .$first()
}

function entryCountQuery(target: EntrySyncTarget) {
  const EntryIndexTable = target.entries
  return builder
    .select({value: count()})
    .from(EntryIndexTable)
    .where(sql.value(true))
    .$first()
}

function setRevisionQuery(target: EntrySyncTarget) {
  const DatabaseState = target.state
  return builder
    .update(DatabaseState)
    .set({revision, tree: sql<Tree>`${treeSnapshot}`})
    .where(eq(DatabaseState.id, 1))
}

function hierarchyQuery(target: EntrySyncTarget) {
  const DerivedEntries = target.changes ?? target.entries
  return builder
    .select({
      id: DerivedEntries.id,
      versionId: DerivedEntries.versionId,
      parentDir: DerivedEntries.parentDir,
      parentId: DerivedEntries.parentId,
      parents: DerivedEntries.parents
    })
    .from(DerivedEntries)
    .innerJoin(SyncAffected, eq(DerivedEntries.id, SyncAffected.id))
    .where(gt(DerivedEntries.versionId, afterVersionId))
    .orderBy(asc(DerivedEntries.versionId))
    .limit(sqliteBatchSize)
}

function levelsQuery(target: EntrySyncTarget) {
  const DerivedEntries = target.changes ?? target.entries
  return builder
    .select({level: DerivedEntries.level})
    .from(DerivedEntries)
    .innerJoin(SyncAffected, eq(DerivedEntries.id, SyncAffected.id))
    .groupBy(DerivedEntries.level)
    .orderBy(asc(DerivedEntries.level))
}

function statusesQuery(target: EntrySyncTarget) {
  const DerivedEntries = target.changes ?? target.entries
  const isDraft = max(eq(DerivedEntries.versionStatus, 'draft'))
  const isPublished = max(eq(DerivedEntries.versionStatus, 'published'))
  const isArchived = max(eq(DerivedEntries.versionStatus, 'archived'))
  return builder
    .select({
      id: DerivedEntries.id,
      locale: DerivedEntries.locale,
      parentId: min(DerivedEntries.parentId),
      activeStatus: when(
        [isDraft, 'draft'],
        [isPublished, 'published'],
        'archived'
      ),
      ownStatus: when(
        [isArchived, 'archived'],
        [and(isDraft, not(isPublished)), 'draft'],
        null
      ),
      mainStatus: when(
        [isPublished, 'published'],
        [isArchived, 'archived'],
        'draft'
      )
    })
    .from(DerivedEntries)
    .innerJoin(SyncAffected, eq(DerivedEntries.id, SyncAffected.id))
    .where(eq(DerivedEntries.level, level))
    .groupBy(DerivedEntries.id, DerivedEntries.locale)
    .orderBy(asc(DerivedEntries.id), asc(DerivedEntries.locale))
}

function mainEntriesQuery(target: EntrySyncTarget) {
  const DerivedEntries = target.changes ?? target.entries
  return builder
    .select({
      versionId: DerivedEntries.versionId,
      id: DerivedEntries.id,
      locale: DerivedEntries.locale,
      type: DerivedEntries.type,
      versionStatus: DerivedEntries.versionStatus,
      workspace: DerivedEntries.workspace,
      root: DerivedEntries.root,
      path: DerivedEntries.path,
      parents: DerivedEntries.parents,
      data: DerivedEntries.data
    })
    .from(DerivedEntries)
    .innerJoin(SyncAffected, eq(DerivedEntries.id, SyncAffected.id))
    .where(
      and(
        eq(DerivedEntries.main, true),
        gt(DerivedEntries.versionId, afterVersionId)
      )
    )
    .orderBy(asc(DerivedEntries.versionId))
    .limit(sqliteBatchSize)
}

function changedIdsQuery() {
  return builder
    .select({id: SyncAffected.id})
    .from(SyncAffected)
    .orderBy(asc(SyncAffected.id))
}

function clearValuesQuery() {
  return builder.delete(SyncValues)
}

function updateChildrenShaQuery(target: EntrySyncTarget) {
  const EntryIndexTable = target.entries
  const updateValueForVersion = builder
    .select(SyncValues.value)
    .from(SyncValues)
    .where(eq(SyncValues.key, EntryIndexTable.versionId))
  return builder
    .update(EntryIndexTable)
    .set({childrenSha: updateValueForVersion})
    .where(
      inArray(
        EntryIndexTable.versionId,
        builder.select(SyncValues.key).from(SyncValues)
      )
    )
}

function updateUrlsQuery(target: EntrySyncTarget) {
  const DerivedEntries = target.changes ?? target.entries
  const MainEntry = alias(DerivedEntries, 'main_entry')
  const hasUpdatedMainUrl = exists(
    builder
      .select({value: sql.value(1)})
      .from(SyncValues)
      .innerJoin(MainEntry, eq(MainEntry.versionId, SyncValues.key))
      .where(
        and(
          eq(MainEntry.id, DerivedEntries.id),
          sql<boolean>`${MainEntry.locale} is ${DerivedEntries.locale}`
        )
      )
  )
  const updatedMainUrl = builder
    .select(SyncValues.value)
    .from(SyncValues)
    .innerJoin(MainEntry, eq(MainEntry.versionId, SyncValues.key))
    .where(
      and(
        eq(MainEntry.id, DerivedEntries.id),
        sql<boolean>`${MainEntry.locale} is ${DerivedEntries.locale}`
      )
    )
  return builder
    .update(DerivedEntries)
    .set({url: updatedMainUrl})
    .where(hasUpdatedMainUrl)
}

function copyInitialUrlsQuery(target: EntrySyncTarget) {
  const EntryIndexTable = target.entries
  const InitialMainEntry = alias(EntryIndexTable, 'initial_main_entry')
  const initialMainUrl = builder
    .select(InitialMainEntry.url)
    .from(InitialMainEntry)
    .where(
      and(
        eq(InitialMainEntry.id, EntryIndexTable.id),
        sql<boolean>`${InitialMainEntry.locale} is ${EntryIndexTable.locale}`,
        eq(InitialMainEntry.main, true)
      )
    )
  return builder.update(EntryIndexTable).set({url: initialMainUrl})
}

function updateHierarchyQuery(target: EntrySyncTarget) {
  const DerivedEntries = target.changes ?? target.entries
  return builder
    .update(DerivedEntries)
    .set({
      parentId: sql<
        string | null
      >`json_extract(${SyncValues.value}, '$.parentId')`,
      parents: sql<
        Array<string>
      >`json_extract(${SyncValues.value}, '$.parents')`
    })
    .from(SyncValues)
    .where(eq(SyncValues.key, DerivedEntries.versionId))
}

function updateStatusQuery(target: EntrySyncTarget) {
  const DerivedEntries = target.changes ?? target.entries
  return builder
    .update(DerivedEntries)
    .set({
      status: sql<
        IndexedEntry['status']
      >`coalesce(${SyncStatus.effectiveStatus}, ${DerivedEntries.versionStatus})`,
      active: eq(DerivedEntries.versionStatus, SyncStatus.activeStatus),
      main: eq(
        DerivedEntries.versionStatus,
        when(
          [isNull(SyncStatus.effectiveStatus), SyncStatus.mainStatus],
          SyncStatus.activeStatus
        )
      ),
      visible: when(
        [isNull(SyncStatus.effectiveStatus), true],
        eq(DerivedEntries.versionStatus, SyncStatus.activeStatus)
      )
    })
    .from(SyncStatus)
    .where(
      sql<boolean>`${SyncStatus.key} = json_array(${DerivedEntries.id}, ${DerivedEntries.locale})`
    )
}

/** Reuse the same INSERT while streaming entries through bounded batches. */
function insertEntryQuery(target: EntrySyncTarget) {
  type Row = ReturnType<typeof entryIndexRow>
  const values = Object.fromEntries(
    Object.keys(EntryIndexColumns).map(name => [name, sql.placeholder(name)])
  ) as {[Key in keyof Row]: Sql<NonNullable<Row[Key]>>}
  return builder.insert(target.entries).values(values)
}

/**
 * Named parameters bypass column encoders, so bind SQLite values explicitly for
 * the placeholders of {@link insertEntryQuery}.
 */
export function insertEntryValues(row: ReturnType<typeof entryIndexRow>) {
  return {
    ...row,
    parents: JSON.stringify(row.parents),
    active: Number(row.active),
    main: Number(row.main),
    visible: Number(row.visible)
  }
}

export function prepareSyncQueries(db: Database, target: EntrySyncTarget) {
  const statements = {
    insertValue: builder
      .insert(SyncValues)
      .values({
        key: sql.placeholder<string>('key'),
        value: sql.placeholder<string>('value')
      })
      .prepare(undefined, db),
    insertStatus: builder
      .insert(SyncStatus)
      .values({
        key: sql.placeholder<string>('key'),
        effectiveStatus: sql.placeholder<string>('effectiveStatus'),
        activeStatus: sql.placeholder<string>('activeStatus'),
        mainStatus: sql.placeholder<string>('mainStatus')
      })
      .prepare(undefined, db),
    insertEntry: insertEntryQuery(target).prepare(undefined, db),
    revision: revisionQuery(target).prepare(undefined, db),
    entryCount: entryCountQuery(target).prepare(undefined, db),
    setRevision: setRevisionQuery(target).prepare(undefined, db),
    hierarchy: hierarchyQuery(target).prepare(undefined, db),
    levels: levelsQuery(target).prepare(undefined, db),
    statuses: statusesQuery(target).prepare(undefined, db),
    mainEntries: mainEntriesQuery(target).prepare(undefined, db),
    changedIds: changedIdsQuery().prepare(undefined, db),
    clearValues: clearValuesQuery().prepare(undefined, db),
    updateChildrenSha: updateChildrenShaQuery(target).prepare(undefined, db),
    updateUrls: updateUrlsQuery(target).prepare(undefined, db),
    copyInitialUrls: copyInitialUrlsQuery(target).prepare(undefined, db),
    updateHierarchy: updateHierarchyQuery(target).prepare(undefined, db),
    updateStatus: updateStatusQuery(target).prepare(undefined, db)
  }
  return {
    ...statements,
    free() {
      for (const statement of Object.values(statements)) statement.free()
    }
  }
}

export type SyncQueries = ReturnType<typeof prepareSyncQueries>

/** Stage key/value pairs and apply the update that reads them back. */
export async function writeValues(
  queries: SyncQueries,
  rows: ReadonlyArray<SyncValueRow>,
  update: SyncQueries['updateChildrenSha' | 'updateHierarchy' | 'updateUrls']
): Promise<void> {
  await queries.clearValues.run()
  for (const row of rows)
    await queries.insertValue.run({key: row.key, value: row.value})
  await update.run()
}

export async function createTemporaryTables(db: Database): Promise<void> {
  await db.create(SyncAffected, SyncCascade, SyncValues, SyncStatus)
}

export async function dropTemporaryTables(db: Database): Promise<void> {
  await db.drop(SyncAffected, SyncCascade, SyncValues, SyncStatus)
}

export async function clearTemporaryTables(
  db: Database,
  queries: SyncQueries
): Promise<void> {
  await db.delete(SyncAffected)
  await db.delete(SyncCascade)
  await queries.clearValues.run()
  await db.delete(SyncStatus)
}
