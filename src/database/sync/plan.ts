import {ReadonlyTree, type Tree} from '#/core/source/Tree.js'
import {
  alias,
  and,
  asc,
  Builder,
  count,
  eq,
  exists,
  gt,
  isNull,
  max,
  min,
  not,
  sql,
  temporaryTable,
  when,
  type Database,
  type Table
} from 'rado'
import * as column from 'rado/universal/columns'
import {
  DatabaseStateColumns,
  DatabaseStateTable,
  EntryIndexTable,
  type EntryIndexTarget,
  type IndexedEntry
} from '../entry/Schema.js'
export const changeBatchSize = 250
export const sqliteBatchSize = 5000

export interface EntrySyncTarget {
  name: string
  entries: EntryIndexTarget
  changes?: EntryIndexTarget
  state: Table<typeof DatabaseStateColumns>
}

export const EntrySyncRoot: EntrySyncTarget = {
  name: 'root',
  entries: EntryIndexTable,
  state: DatabaseStateTable
}

export interface EntrySyncOptions {
  previousTree?: ReadonlyTree
  withinTransaction?: boolean
}

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

export interface FileRow {
  filePath: string
  fileHash: string
}

export interface StoredFileRow extends FileRow {
  id: string
  versionId: string
  childrenDir: string
  childrenSha: string | null
}

export interface StoredHierarchyRow {
  versionId: string
  parentDir: string
  parentId: string | null
  parents: Array<string>
}

export interface MainRow {
  versionId: string
  id: string
  locale: string | null
  type: string
  versionStatus: string
  workspace: string
  root: string
  path: string
  parents: Array<string>
  data: string
}

export interface ParentPathRow {
  id: string
  locale: string | null
  path: string
}

export interface HierarchyRow {
  id: string
  versionId: string
  parentDir: string
  parentId: string | null
  parents: Array<string>
}

export interface DirectoryRow {
  id: string
  childrenDir: string
}

export interface DirectoryHashRow extends DirectoryRow {
  versionId: string
  childrenSha: string | null
}

export interface AffectedEntryRow {
  id: string
  filePath: string
  childrenSha: string | null
}

export interface StatusRow {
  id: string
  locale: string | null
  parentId: string | null
  activeStatus: string
  ownStatus: string | null
  mainStatus: string
}

export function* chunks<T>(
  items: ReadonlyArray<T>,
  size: number
): Generator<Array<T>> {
  for (let offset = 0; offset < items.length; offset += size)
    yield items.slice(offset, offset + size)
}

const builder = new Builder()
const afterFilePath = sql.placeholder<string>('afterFilePath')
const afterEntryId = sql.placeholder<string>('afterEntryId')
const afterVersionId = sql.placeholder<string>('afterVersionId')
const level = sql.placeholder<number>('level')
const revision = sql.placeholder<string>('revision')
const treeSnapshot = sql.placeholder<string | null>('tree')
export function prepareRevision(db: Database, target: EntrySyncTarget) {
  const DatabaseState = target.state
  return builder
    .select({revision: DatabaseState.revision, tree: DatabaseState.tree})
    .from(DatabaseState)
    .where(eq(DatabaseState.id, 1))
    .$first()

    .prepare(undefined, db)
}

export function prepareEntryCount(db: Database, target: EntrySyncTarget) {
  const EntryIndexTable = target.entries
  return builder
    .select({value: count()})
    .from(EntryIndexTable)
    .where(sql.value(true))
    .$first()

    .prepare(undefined, db)
}

export function prepareSetRevision(db: Database, target: EntrySyncTarget) {
  const DatabaseState = target.state
  return builder
    .update(DatabaseState)
    .set({revision, tree: sql<Tree>`${treeSnapshot}`})
    .where(eq(DatabaseState.id, 1))

    .prepare<{revision: string; tree: string | null}>(undefined, db)
}

export function prepareStoredFiles(db: Database, target: EntrySyncTarget) {
  const EntryIndexTable = target.entries
  return builder
    .select({
      id: EntryIndexTable.id,
      filePath: EntryIndexTable.filePath,
      fileHash: EntryIndexTable.fileHash,
      versionId: EntryIndexTable.versionId,
      childrenDir: EntryIndexTable.childrenDir,
      childrenSha: EntryIndexTable.childrenSha
    })
    .from(EntryIndexTable)
    .where(gt(EntryIndexTable.filePath, afterFilePath))
    .orderBy(asc(EntryIndexTable.filePath))
    .limit(sqliteBatchSize)

    .prepare<{afterFilePath: string}>(undefined, db)
}

export function prepareHierarchy(db: Database, target: EntrySyncTarget) {
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

    .prepare<{afterVersionId: string}>(undefined, db)
}

export function prepareLevels(db: Database, target: EntrySyncTarget) {
  const DerivedEntries = target.changes ?? target.entries
  return builder
    .select({level: DerivedEntries.level})
    .from(DerivedEntries)
    .innerJoin(SyncAffected, eq(DerivedEntries.id, SyncAffected.id))
    .groupBy(DerivedEntries.level)
    .orderBy(asc(DerivedEntries.level))

    .prepare(undefined, db)
}

export function prepareStatuses(db: Database, target: EntrySyncTarget) {
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

    .prepare<{level: number}>(undefined, db)
}

export function prepareMainEntries(db: Database, target: EntrySyncTarget) {
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

    .prepare<{afterVersionId: string}>(undefined, db)
}

export function prepareChangedIds(db: Database, target: EntrySyncTarget) {
  return builder
    .select({id: SyncAffected.id})
    .from(SyncAffected)
    .orderBy(asc(SyncAffected.id))

    .prepare(undefined, db)
}

export function prepareClearAffected(db: Database, target: EntrySyncTarget) {
  return builder
    .delete(SyncAffected)

    .prepare(undefined, db)
}

export function prepareClearCascade(db: Database, target: EntrySyncTarget) {
  return builder
    .delete(SyncCascade)

    .prepare(undefined, db)
}

export function prepareClearValues(db: Database, target: EntrySyncTarget) {
  return builder
    .delete(SyncValues)

    .prepare(undefined, db)
}

export function prepareClearStatus(db: Database, target: EntrySyncTarget) {
  return builder
    .delete(SyncStatus)

    .prepare(undefined, db)
}

export function prepareMarkAllAffected(db: Database, target: EntrySyncTarget) {
  const EntryIndexTable = target.entries
  return builder
    .insert(SyncAffected)
    .select(
      builder.selectDistinct({id: EntryIndexTable.id}).from(EntryIndexTable)
    )

    .prepare(undefined, db)
}

export function prepareUpdateChildrenSha(
  db: Database,
  target: EntrySyncTarget
) {
  const EntryIndexTable = target.entries
  const updateValueForVersion = builder
    .select(SyncValues.value)
    .from(SyncValues)
    .where(eq(SyncValues.key, EntryIndexTable.versionId))
  const hasUpdateValueForVersion = exists(
    builder
      .select({value: sql.value(1)})
      .from(SyncValues)
      .where(eq(SyncValues.key, EntryIndexTable.versionId))
  )
  return builder
    .update(EntryIndexTable)
    .set({childrenSha: updateValueForVersion})
    .where(hasUpdateValueForVersion)

    .prepare(undefined, db)
}

export function prepareUpdateUrls(db: Database, target: EntrySyncTarget) {
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

    .prepare(undefined, db)
}

export function prepareCopyInitialUrls(db: Database, target: EntrySyncTarget) {
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
  return builder
    .update(EntryIndexTable)
    .set({url: initialMainUrl})

    .prepare(undefined, db)
}

export function prepareUpdateHierarchy(db: Database, target: EntrySyncTarget) {
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

    .prepare(undefined, db)
}

export function prepareUpdateStatus(db: Database, target: EntrySyncTarget) {
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

    .prepare(undefined, db)
}

export function prepareSyncQueries(db: Database, target: EntrySyncTarget) {
  const statements = {
    revision: prepareRevision(db, target),
    entryCount: prepareEntryCount(db, target),
    setRevision: prepareSetRevision(db, target),
    storedFiles: prepareStoredFiles(db, target),
    hierarchy: prepareHierarchy(db, target),
    levels: prepareLevels(db, target),
    statuses: prepareStatuses(db, target),
    mainEntries: prepareMainEntries(db, target),
    changedIds: prepareChangedIds(db, target),
    clearAffected: prepareClearAffected(db, target),
    clearCascade: prepareClearCascade(db, target),
    clearValues: prepareClearValues(db, target),
    clearStatus: prepareClearStatus(db, target),
    markAllAffected: prepareMarkAllAffected(db, target),
    updateChildrenSha: prepareUpdateChildrenSha(db, target),
    updateUrls: prepareUpdateUrls(db, target),
    copyInitialUrls: prepareCopyInitialUrls(db, target),
    updateHierarchy: prepareUpdateHierarchy(db, target),
    updateStatus: prepareUpdateStatus(db, target)
  }
  return {
    ...statements,
    free() {
      for (const statement of Object.values(statements)) statement.free()
    }
  }
}

export type SyncQueries = ReturnType<typeof prepareSyncQueries>

export async function createTemporaryTables(db: Database): Promise<void> {
  await db.create(SyncAffected, SyncCascade, SyncValues, SyncStatus)
}

export async function dropTemporaryTables(db: Database): Promise<void> {
  await db.drop(SyncAffected, SyncCascade, SyncValues, SyncStatus)
}

export async function clearTemporaryTables(
  queries: SyncQueries
): Promise<void> {
  await queries.clearAffected.run()
  await queries.clearCascade.run()
  await queries.clearValues.run()
  await queries.clearStatus.run()
}
