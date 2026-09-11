import type {Config} from '#/core/Config.js'
import type {RemoteSource} from '#/core/source/Source.js'
import {Leaf, ReadonlyTree, type Tree} from '#/core/source/Tree.js'
import {assert} from '#/core/util/Assert.js'
import {entryUrl} from '#/core/util/EntryFilenames.js'
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
  ne,
  not,
  or,
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
  entryIndexRow,
  type EntryIndexTarget,
  type IndexedEntry
} from '../entry/Schema.js'
import {parseSourceEntry} from './EntryParser.js'

const changeBatchSize = 750
const sqliteBatchSize = 500

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

interface EntrySyncOptions {
  previousTree?: ReadonlyTree
  withinTransaction?: boolean
}

const SyncAffected = temporaryTable('alinea_sync_affected', {
  id: column.text().primaryKey()
})

const SyncCascade = temporaryTable('alinea_sync_cascade', {
  id: column.text().primaryKey()
})

const SyncValues = temporaryTable('alinea_sync_values', {
  key: column.text().primaryKey(),
  value: column.text().notNull()
})

const SyncStatus = temporaryTable('alinea_sync_status', {
  key: column.text().primaryKey(),
  effectiveStatus: column.text().$type<string | null>(),
  activeStatus: column.text().notNull(),
  mainStatus: column.text().notNull()
})

interface FileRow {
  filePath: string
  fileHash: string
}

interface StoredFileRow extends FileRow {
  id: string
  versionId: string
  childrenDir: string
  childrenSha: string | null
}

interface StoredHierarchyRow {
  versionId: string
  parentDir: string
  parentId: string | null
  parents: Array<string>
}

interface MainRow {
  versionId: string
  id: string
  locale: string | null
  type: string
  versionStatus: string
  workspace: string
  root: string
  path: string
  parents: Array<string>
  data: Record<string, unknown>
}

interface ParentPathRow {
  id: string
  locale: string | null
  path: string
}

interface HierarchyRow {
  id: string
  versionId: string
  parentDir: string
  parentId: string | null
  parents: Array<string>
}

interface DirectoryRow {
  id: string
  childrenDir: string
}

interface DirectoryHashRow extends DirectoryRow {
  versionId: string
  childrenSha: string | null
}

interface AffectedEntryRow {
  id: string
  filePath: string
  childrenSha: string | null
}

interface StatusRow {
  id: string
  locale: string | null
  parentId: string | null
  activeStatus: string
  ownStatus: string | null
  mainStatus: string
}

function* chunks<T>(
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
const offset = sql.placeholder<number>('offset')
const revision = sql.placeholder<string>('revision')
const treeSnapshot = sql.placeholder<string | null>('tree')
function createSyncQueryPlan(target: EntrySyncTarget) {
  const EntryIndexTable = target.entries
  const DerivedEntries = target.changes ?? target.entries
  const DatabaseState = target.state
  const isDraft = max(eq(DerivedEntries.versionStatus, 'draft'))
  const isPublished = max(eq(DerivedEntries.versionStatus, 'published'))
  const isArchived = max(eq(DerivedEntries.versionStatus, 'archived'))

  const revisionQuery = builder
    .select({revision: DatabaseState.revision, tree: DatabaseState.tree})
    .from(DatabaseState)
    .where(eq(DatabaseState.id, 1))
    .$first()
  const entryCountQuery = builder
    .select({value: count()})
    .from(EntryIndexTable)
    .where(sql.value(true))
    .$first()
  const setRevisionQuery = builder
    .update(DatabaseState)
    .set({revision, tree: sql<Tree>`${treeSnapshot}`})
    .where(eq(DatabaseState.id, 1))
  const storedFilesQuery = builder
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
  const hierarchyQuery = builder
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
  const levelsQuery = builder
    .select({level: DerivedEntries.level})
    .from(DerivedEntries)
    .innerJoin(SyncAffected, eq(DerivedEntries.id, SyncAffected.id))
    .groupBy(DerivedEntries.level)
    .orderBy(asc(DerivedEntries.level))
  const statusesQuery = builder
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
    .limit(sqliteBatchSize)
    .offset(offset)
  const mainEntriesQuery = builder
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
  const changedIdsQuery = builder
    .select({id: SyncAffected.id})
    .from(SyncAffected)
    .orderBy(asc(SyncAffected.id))
  const clearAffectedQuery = builder.delete(SyncAffected)
  const clearCascadeQuery = builder.delete(SyncCascade)
  const clearValuesQuery = builder.delete(SyncValues)
  const clearStatusQuery = builder.delete(SyncStatus)
  const markAllAffectedQuery = builder
    .insert(SyncAffected)
    .select(
      builder.selectDistinct({id: EntryIndexTable.id}).from(EntryIndexTable)
    )
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
  const updateChildrenShaQuery = builder
    .update(EntryIndexTable)
    .set({childrenSha: updateValueForVersion})
    .where(hasUpdateValueForVersion)
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
  const updateUrlsQuery = builder
    .update(DerivedEntries)
    .set({url: updatedMainUrl})
    .where(hasUpdatedMainUrl)
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
  const copyInitialUrlsQuery = builder
    .update(EntryIndexTable)
    .set({url: initialMainUrl})
  const updateHierarchyQuery = builder
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
  const updateStatusQuery = builder
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

  return {
    revision: revisionQuery,
    entryCount: entryCountQuery,
    setRevision: setRevisionQuery,
    storedFiles: storedFilesQuery,
    hierarchy: hierarchyQuery,
    levels: levelsQuery,
    statuses: statusesQuery,
    mainEntries: mainEntriesQuery,
    changedIds: changedIdsQuery,
    clearAffected: clearAffectedQuery,
    clearCascade: clearCascadeQuery,
    clearValues: clearValuesQuery,
    clearStatus: clearStatusQuery,
    markAllAffected: markAllAffectedQuery,
    updateChildrenSha: updateChildrenShaQuery,
    updateUrls: updateUrlsQuery,
    copyInitialUrls: copyInitialUrlsQuery,
    updateHierarchy: updateHierarchyQuery,
    updateStatus: updateStatusQuery
  }
}

function prepareSyncQueries(db: Database, target: EntrySyncTarget) {
  const query = createSyncQueryPlan(target)
  const statements = {
    revision: query.revision.prepare(undefined, db),
    entryCount: query.entryCount.prepare(undefined, db),
    setRevision: query.setRevision.prepare<{
      revision: string
      tree: string | null
    }>(undefined, db),
    storedFiles: query.storedFiles.prepare<{afterFilePath: string}>(
      undefined,
      db
    ),
    hierarchy: query.hierarchy.prepare<{afterVersionId: string}>(undefined, db),
    levels: query.levels.prepare(undefined, db),
    statuses: query.statuses.prepare<{level: number; offset: number}>(
      undefined,
      db
    ),
    mainEntries: query.mainEntries.prepare<{afterVersionId: string}>(
      undefined,
      db
    ),
    changedIds: query.changedIds.prepare(undefined, db),
    clearAffected: query.clearAffected.prepare(undefined, db),
    clearCascade: query.clearCascade.prepare(undefined, db),
    clearValues: query.clearValues.prepare(undefined, db),
    clearStatus: query.clearStatus.prepare(undefined, db),
    markAllAffected: query.markAllAffected.prepare(undefined, db),
    updateChildrenSha: query.updateChildrenSha.prepare(undefined, db),
    updateUrls: query.updateUrls.prepare(undefined, db),
    copyInitialUrls: query.copyInitialUrls.prepare(undefined, db),
    updateHierarchy: query.updateHierarchy.prepare(undefined, db),
    updateStatus: query.updateStatus.prepare(undefined, db)
  }
  return {
    ...statements,
    async free() {
      await Promise.all(
        Object.values(statements).map(statement =>
          statement[Symbol.asyncDispose]()
        )
      )
    }
  }
}

type SyncQueries = ReturnType<typeof prepareSyncQueries>

async function createTemporaryTables(db: Database): Promise<void> {
  await db.create(SyncAffected, SyncCascade, SyncValues, SyncStatus)
}

async function dropTemporaryTables(db: Database): Promise<void> {
  await db.drop(SyncAffected, SyncCascade, SyncValues, SyncStatus)
}

async function clearTemporaryTables(queries: SyncQueries): Promise<void> {
  await queries.clearAffected.run()
  await queries.clearCascade.run()
  await queries.clearValues.run()
  await queries.clearStatus.run()
}

async function markAffected(
  db: Database,
  EntryIndexTable: EntryIndexTarget,
  filePaths: ReadonlyArray<string>,
  versionIds: ReadonlyArray<string> = []
): Promise<Array<AffectedEntryRow>> {
  if (!filePaths.length && !versionIds.length) return []
  const existing = (await db
    .select({
      id: EntryIndexTable.id,
      filePath: EntryIndexTable.filePath,
      childrenSha: EntryIndexTable.childrenSha
    })
    .from(EntryIndexTable)
    .where(
      or(
        filePaths.length
          ? inArray(EntryIndexTable.filePath, Array.from(filePaths))
          : undefined,
        versionIds.length
          ? inArray(EntryIndexTable.versionId, Array.from(versionIds))
          : undefined
      )
    )) as Array<AffectedEntryRow>
  await addAffected(
    db,
    existing.map(row => row.id)
  )
  await addCascade(
    db,
    existing.flatMap(row =>
      row.childrenSha && row.childrenSha !== ReadonlyTree.EMPTY.sha
        ? [row.id]
        : []
    )
  )
  return existing
}

async function addAffected(db: Database, ids: Iterable<string>): Promise<void> {
  const unique = Array.from(new Set(ids))
  if (!unique.length) return
  const existing = await db
    .select({id: SyncAffected.id})
    .from(SyncAffected)
    .where(inArray(SyncAffected.id, unique))
  const present = new Set(existing.map(row => row.id))
  const missing = unique.filter(id => !present.has(id))
  if (missing.length)
    await db.insert(SyncAffected).values(missing.map(id => ({id})))
}

async function addCascade(db: Database, ids: Iterable<string>): Promise<void> {
  const unique = Array.from(new Set(ids))
  if (!unique.length) return
  const existing = await db
    .select({id: SyncCascade.id})
    .from(SyncCascade)
    .where(inArray(SyncCascade.id, unique))
  const present = new Set(existing.map(row => row.id))
  const missing = unique.filter(id => !present.has(id))
  if (missing.length)
    await db.insert(SyncCascade).values(missing.map(id => ({id})))
}

async function deleteFiles(
  db: Database,
  EntryIndexTable: EntryIndexTarget,
  filePaths: ReadonlyArray<string>
): Promise<void> {
  if (!filePaths.length) return
  const existing = await markAffected(db, EntryIndexTable, filePaths)
  const found = new Set(existing.map(row => row.filePath))
  for (const filePath of filePaths)
    assert(found.has(filePath), `Missing version to delete: ${filePath}`)
  await db
    .delete(EntryIndexTable)
    .where(inArray(EntryIndexTable.filePath, Array.from(filePaths)))
}

async function replaceFiles(
  db: Database,
  EntryIndexTable: EntryIndexTarget,
  config: Config,
  source: RemoteSource,
  tree: ReadonlyTree,
  files: ReadonlyArray<FileRow>
): Promise<void> {
  if (!files.length) return
  const pathsByHash = new Map<string, Array<string>>()
  for (const file of files) {
    const paths = pathsByHash.get(file.fileHash) ?? []
    paths.push(file.filePath)
    pathsByHash.set(file.fileHash, paths)
  }
  const entries = Array<IndexedEntry>()
  const found = new Set<string>()
  for await (const [fileHash, blob] of source.getBlobs([
    ...pathsByHash.keys()
  ])) {
    const paths = pathsByHash.get(fileHash)
    if (!paths) continue
    found.add(fileHash)
    for (const filePath of paths)
      entries.push(parseSourceEntry(config, filePath, fileHash, blob))
  }
  for (const fileHash of pathsByHash.keys())
    assert(found.has(fileHash), `Source did not return blob ${fileHash}`)
  const rows = entries.map(entry => ({
    ...entryIndexRow(entry),
    childrenSha: sourceDirectorySha(tree, entry.childrenDir)
  }))
  const filePaths = rows.map(row => row.filePath)
  const versionIds = rows.map(row => row.versionId)
  const previous = (await db
    .select({
      versionId: EntryIndexTable.versionId,
      parentDir: EntryIndexTable.parentDir,
      parentId: EntryIndexTable.parentId,
      parents: EntryIndexTable.parents
    })
    .from(EntryIndexTable)
    .where(
      or(
        inArray(EntryIndexTable.filePath, filePaths),
        inArray(EntryIndexTable.versionId, versionIds)
      )
    )) as Array<StoredHierarchyRow>
  const previousByVersion = new Map(previous.map(row => [row.versionId, row]))
  for (const row of rows) {
    const stored = previousByVersion.get(row.versionId)
    if (!stored || stored.parentDir !== row.parentDir) continue
    row.parentId = stored.parentId
    row.parents = stored.parents
  }
  await markAffected(db, EntryIndexTable, filePaths, versionIds)
  await db
    .delete(EntryIndexTable)
    .where(
      or(
        inArray(EntryIndexTable.filePath, filePaths),
        inArray(EntryIndexTable.versionId, versionIds)
      )
    )
  await db.insert(EntryIndexTable).values(rows)
  await addAffected(
    db,
    rows.map(row => row.id)
  )
  await addCascade(
    db,
    rows.flatMap(row =>
      row.childrenSha && row.childrenSha !== ReadonlyTree.EMPTY.sha
        ? [row.id]
        : []
    )
  )
}

async function insertInitialSource(
  db: Database,
  EntryIndexTable: EntryIndexTarget,
  config: Config,
  source: RemoteSource,
  tree: ReadonlyTree,
  queries: SyncQueries
): Promise<void> {
  const pathsByHash = new Map<string, Array<string>>()
  for (const [filePath, node] of tree) {
    if (!(node instanceof Leaf)) continue
    const paths = pathsByHash.get(node.sha) ?? []
    paths.push(filePath)
    pathsByHash.set(node.sha, paths)
  }
  const found = new Set<string>()
  let rows = Array<ReturnType<typeof entryIndexRow>>()
  async function flush(): Promise<void> {
    if (!rows.length) return
    await db.insert(EntryIndexTable).values(rows)
    rows = []
  }
  for await (const [fileHash, blob] of source.getBlobs([
    ...pathsByHash.keys()
  ])) {
    const paths = pathsByHash.get(fileHash)
    if (!paths) continue
    found.add(fileHash)
    for (const filePath of paths) {
      const entry = parseSourceEntry(config, filePath, fileHash, blob)
      rows.push({
        ...entryIndexRow(entry),
        childrenSha: sourceDirectorySha(tree, entry.childrenDir)
      })
      if (rows.length >= changeBatchSize) await flush()
    }
  }
  await flush()
  for (const fileHash of pathsByHash.keys())
    assert(found.has(fileHash), `Source did not return blob ${fileHash}`)
  await queries.markAllAffected.run()
}

async function* storedFiles(
  queries: SyncQueries
): AsyncGenerator<StoredFileRow> {
  let afterFilePath = ''
  for (;;) {
    const rows = (await queries.storedFiles.all({
      afterFilePath
    })) as Array<StoredFileRow>
    if (!rows.length) return
    for (const row of rows) yield row
    afterFilePath = rows.at(-1)!.filePath
  }
}

async function mergeSource(
  db: Database,
  EntryIndexTable: EntryIndexTarget,
  config: Config,
  source: RemoteSource,
  tree: ReadonlyTree,
  queries: SyncQueries
): Promise<void> {
  const stored = storedFiles(queries)[Symbol.asyncIterator]()
  function* sourceFiles(): Generator<[string, Leaf]> {
    for (const [filePath, node] of tree)
      if (node instanceof Leaf) yield [filePath, node]
  }
  const incoming = sourceFiles()
  let currentStored = await stored.next()
  let currentIncoming = incoming.next()
  let removed = Array<string>()
  let changed = Array<FileRow>()
  let directoryHashes = Array<{key: string; value: string}>()
  let directoryIds = Array<string>()

  async function flush(): Promise<void> {
    await deleteFiles(db, EntryIndexTable, removed)
    await replaceFiles(db, EntryIndexTable, config, source, tree, changed)
    if (directoryHashes.length) {
      await addAffected(db, directoryIds)
      await queries.clearValues.run()
      await db.insert(SyncValues).values(directoryHashes)
      await queries.updateChildrenSha.run()
    }
    removed = []
    changed = []
    directoryHashes = []
    directoryIds = []
  }

  while (!currentStored.done || !currentIncoming.done) {
    const storedRow = currentStored.done ? undefined : currentStored.value
    const incomingRow = currentIncoming.done
      ? undefined
      : {
          filePath: currentIncoming.value[0],
          fileHash: currentIncoming.value[1].sha
        }
    if (
      !incomingRow ||
      (storedRow && storedRow.filePath < incomingRow.filePath)
    ) {
      removed.push(storedRow!.filePath)
      currentStored = await stored.next()
    } else if (!storedRow || incomingRow.filePath < storedRow.filePath) {
      changed.push(incomingRow)
      currentIncoming = incoming.next()
    } else {
      if (storedRow.fileHash !== incomingRow.fileHash) {
        changed.push(incomingRow)
      } else {
        const childrenSha = sourceDirectorySha(tree, storedRow.childrenDir)
        if (childrenSha !== storedRow.childrenSha) {
          directoryHashes.push({key: storedRow.versionId, value: childrenSha})
          directoryIds.push(storedRow.id)
        }
      }
      currentStored = await stored.next()
      currentIncoming = incoming.next()
    }
    if (
      removed.length + changed.length + directoryHashes.length >=
      changeBatchSize
    )
      await flush()
  }
  await flush()
}

function parentDirectories(filePath: string): Array<string> {
  const result = Array<string>()
  let slash = filePath.lastIndexOf('/')
  while (slash !== -1) {
    result.push(filePath.slice(0, slash))
    slash = filePath.lastIndexOf('/', slash - 1)
  }
  return result
}

async function updateDirectoryHashes(
  db: Database,
  EntryIndexTable: EntryIndexTarget,
  tree: ReadonlyTree,
  queries: SyncQueries,
  filePaths: ReadonlyArray<string>
): Promise<void> {
  const directories = new Set(filePaths.flatMap(parentDirectories))
  for (const paths of chunks(Array.from(directories), sqliteBatchSize)) {
    const rows = (await db
      .select({
        id: EntryIndexTable.id,
        versionId: EntryIndexTable.versionId,
        childrenDir: EntryIndexTable.childrenDir,
        childrenSha: EntryIndexTable.childrenSha
      })
      .from(EntryIndexTable)
      .where(
        inArray(EntryIndexTable.childrenDir, paths)
      )) as Array<DirectoryHashRow>
    const changed = rows.filter(row => {
      const childrenSha = sourceDirectorySha(tree, row.childrenDir)
      return childrenSha !== row.childrenSha
    })
    if (!changed.length) continue
    await addAffected(
      db,
      changed.map(row => row.id)
    )
    await queries.clearValues.run()
    await db.insert(SyncValues).values(
      changed.map(row => ({
        key: row.versionId,
        value: sourceDirectorySha(tree, row.childrenDir)
      }))
    )
    await queries.updateChildrenSha.run()
  }
}

async function mergeTrees(
  db: Database,
  EntryIndexTable: EntryIndexTarget,
  config: Config,
  source: RemoteSource,
  previousTree: ReadonlyTree,
  tree: ReadonlyTree,
  queries: SyncQueries
): Promise<void> {
  const changes = previousTree.diff(tree).changes
  for (const batch of chunks(changes, changeBatchSize)) {
    await deleteFiles(
      db,
      EntryIndexTable,
      batch.filter(change => change.op === 'delete').map(change => change.path)
    )
    await replaceFiles(
      db,
      EntryIndexTable,
      config,
      source,
      tree,
      batch.flatMap(change =>
        change.op === 'add'
          ? [{filePath: change.path, fileHash: change.sha}]
          : []
      )
    )
  }
  await updateDirectoryHashes(
    db,
    EntryIndexTable,
    tree,
    queries,
    changes.map(change => change.path)
  )
}

function sourceDirectorySha(tree: ReadonlyTree, path: string): string {
  const node = tree.get(path)
  if (!node) return ReadonlyTree.EMPTY.sha
  assert(!(node instanceof Leaf), `Entry children path is a file: ${path}`)
  return node.sha
}

async function deriveHierarchy(
  db: Database,
  EntryIndexTable: EntryIndexTarget,
  queries: SyncQueries
): Promise<boolean> {
  let changed = false
  let afterVersionId = ''
  for (;;) {
    const rows = (await queries.hierarchy.all({
      afterVersionId
    })) as Array<HierarchyRow>
    if (!rows.length) return changed
    afterVersionId = rows.at(-1)!.versionId
    const prefixesByVersionId = new Map<string, Array<string>>()
    const needed = new Set<string>()
    for (const row of rows) {
      const segments = row.parentDir.split('/')
      const prefixes = segments.map((_, index) =>
        segments.slice(0, index + 1).join('/')
      )
      prefixesByVersionId.set(row.versionId, prefixes)
      for (const prefix of prefixes) needed.add(prefix)
    }
    const directories = Array<DirectoryRow>()
    for (const paths of chunks(Array.from(needed), sqliteBatchSize))
      directories.push(
        ...((await db
          .select({
            id: EntryIndexTable.id,
            childrenDir: EntryIndexTable.childrenDir
          })
          .from(EntryIndexTable)
          .where(inArray(EntryIndexTable.childrenDir, paths))
          .groupBy(EntryIndexTable.childrenDir)) as Array<DirectoryRow>)
      )
    const idByDirectory = new Map<string, string>()
    for (const directory of directories)
      idByDirectory.set(directory.childrenDir, directory.id)
    const hierarchy = rows.flatMap(row => {
      const parents = (prefixesByVersionId.get(row.versionId) ?? []).flatMap(
        path => {
          const id = idByDirectory.get(path)
          return id ? [id] : []
        }
      )
      const parentId = parents.at(-1) ?? null
      const unchanged =
        row.parentId === parentId &&
        row.parents.length === parents.length &&
        row.parents.every((id, index) => id === parents[index])
      return unchanged
        ? []
        : [{key: row.versionId, value: JSON.stringify({parentId, parents})}]
    })
    if (!hierarchy.length) continue
    changed = true
    await queries.clearValues.run()
    await db.insert(SyncValues).values(hierarchy)
    await queries.updateHierarchy.run()
  }
}

async function expandAffected(
  db: Database,
  EntryIndexTable: EntryIndexTarget
): Promise<void> {
  await db.run(sql`
    with recursive descendants(id) as (
      select id from alinea_sync_cascade
      union
      select entry.id from ${EntryIndexTable} entry
      join descendants on entry.parentId = descendants.id
    )
    insert or ignore into alinea_sync_affected(id) select id from descendants;
  `)
}

async function materializeAffected(
  db: Database,
  target: EntrySyncTarget,
  queries: SyncQueries,
  materialized: Set<string>
): Promise<void> {
  if (!target.changes) return
  const affected = (await queries.changedIds.all()) as Array<{id: string}>
  const candidates = affected
    .map(row => row.id)
    .filter(id => !materialized.has(id))
  for (const ids of chunks(candidates, sqliteBatchSize)) {
    const resident = await db
      .select({id: target.changes.id})
      .from(target.changes)
      .where(inArray(target.changes.id, ids))
      .groupBy(target.changes.id)
    for (const row of resident) materialized.add(row.id)
  }
  const missing = candidates.filter(id => !materialized.has(id))
  for (const ids of chunks(missing, sqliteBatchSize)) {
    await db
      .update(target.entries)
      .set({versionId: target.entries.versionId})
      .where(inArray(target.entries.id, ids))
  }
  for (const id of missing) materialized.add(id)
}

async function deriveStatus(db: Database, queries: SyncQueries): Promise<void> {
  const levels = (await queries.levels.all()) as Array<{level: number}>
  for (const {level} of levels) {
    let offset = 0
    for (;;) {
      const rows = (await queries.statuses.all({
        level,
        offset
      })) as Array<StatusRow>
      if (!rows.length) break
      offset += rows.length
      const parentKeys = Array.from(
        new Set(
          rows.flatMap(row =>
            row.parentId ? [statusKey(row.parentId, row.locale)] : []
          )
        )
      )
      const parents = parentKeys.length
        ? await db
            .select()
            .from(SyncStatus)
            .where(inArray(SyncStatus.key, parentKeys))
        : []
      const parentByKey = new Map(parents.map(parent => [parent.key, parent]))
      await db.insert(SyncStatus).values(
        rows.map(row => {
          const parent = row.parentId
            ? parentByKey.get(statusKey(row.parentId, row.locale))
            : undefined
          return {
            key: statusKey(row.id, row.locale),
            effectiveStatus: parent?.effectiveStatus ?? row.ownStatus,
            activeStatus: row.activeStatus,
            mainStatus: row.mainStatus
          }
        })
      )
    }
  }
  await queries.updateStatus.run()
}

function statusKey(id: string, locale: string | null): string {
  return JSON.stringify([id, locale])
}

function parentPathKey(id: string, locale: string | null): string {
  return `${id}\0${locale ?? ''}`
}

async function deriveUrls(
  db: Database,
  EntryIndexTable: EntryIndexTarget,
  config: Config,
  queries: SyncQueries
): Promise<void> {
  let afterVersionId = ''
  for (;;) {
    const rows = (await queries.mainEntries.all({
      afterVersionId
    })) as Array<MainRow>
    if (!rows.length) break
    afterVersionId = rows.at(-1)!.versionId
    const parentIds = Array.from(new Set(rows.flatMap(row => row.parents)))
    const parentPaths = parentIds.length
      ? ((await db
          .select({
            id: EntryIndexTable.id,
            locale: EntryIndexTable.locale,
            path: EntryIndexTable.path
          })
          .from(EntryIndexTable)
          .where(
            and(
              eq(EntryIndexTable.main, true),
              inArray(EntryIndexTable.id, parentIds)
            )
          )) as Array<ParentPathRow>)
      : []
    const pathByParent = new Map<string, string>()
    for (const parent of parentPaths)
      pathByParent.set(parentPathKey(parent.id, parent.locale), parent.path)
    const urls = Array<{key: string; value: string}>()
    for (const row of rows) {
      const type = config.schema[row.type]
      assert(type, `Entry ${row.id} has an unknown type: ${row.type}`)
      const paths = row.parents.map(id => {
        const path = pathByParent.get(parentPathKey(id, row.locale))
        assert(path !== undefined, `Missing parent path for ${id}`)
        return path
      })
      urls.push({
        key: row.versionId,
        value: entryUrl(type, {
          config,
          data: row.data,
          status: row.versionStatus as IndexedEntry['versionStatus'],
          path: row.path,
          parentPaths: paths,
          locale: row.locale,
          workspace: row.workspace,
          root: row.root
        })
      })
    }
    await queries.clearValues.run()
    await db.insert(SyncValues).values(urls)
    await queries.updateUrls.run()
  }
}

/** Validate authored relationships that SQLite column constraints cannot express. */
async function validateEntries(
  db: Database,
  entries: EntryIndexTarget
): Promise<void> {
  const minParent = min(sql<string>`coalesce(${entries.parentId}, '')`)
  const maxParent = max(sql<string>`coalesce(${entries.parentId}, '')`)
  const node = await db
    .select({
      id: entries.id,
      minType: min(entries.type),
      maxType: max(entries.type),
      minIndex: min(entries.index),
      maxIndex: max(entries.index),
      minRoot: min(entries.root),
      maxRoot: max(entries.root),
      minWorkspace: min(entries.workspace),
      maxWorkspace: max(entries.workspace),
      minParent,
      maxParent
    })
    .from(entries)
    .innerJoin(SyncAffected, eq(entries.id, SyncAffected.id))
    .groupBy(entries.id)
    .having(
      or(
        ne(min(entries.type), max(entries.type)),
        ne(min(entries.index), max(entries.index)),
        ne(min(entries.root), max(entries.root)),
        ne(min(entries.workspace), max(entries.workspace)),
        ne(minParent, maxParent)
      )
    )
    .get()
  if (node) {
    const versions = await db
      .select({
        id: entries.id,
        locale: entries.locale,
        filePath: entries.filePath,
        parentDir: entries.parentDir,
        parentId: entries.parentId
      })
      .from(entries)
      .where(eq(entries.id, node.id))
    assert(
      false,
      `Mismatched authored entry versions for ${node.id}: ${JSON.stringify({node, versions})}`
    )
  }

  const language = await db
    .select({
      id: entries.id,
      locale: entries.locale,
      minPath: min(entries.path),
      maxPath: max(entries.path),
      minParentDir: min(entries.parentDir),
      maxParentDir: max(entries.parentDir),
      minChildrenDir: min(entries.childrenDir),
      maxChildrenDir: max(entries.childrenDir)
    })
    .from(entries)
    .innerJoin(SyncAffected, eq(entries.id, SyncAffected.id))
    .groupBy(entries.id, entries.locale)
    .having(
      or(
        ne(min(entries.path), max(entries.path)),
        ne(min(entries.parentDir), max(entries.parentDir)),
        ne(min(entries.childrenDir), max(entries.childrenDir))
      )
    )
    .get()
  assert(
    !language,
    `Mismatched authored language versions for ${language?.id} (${language?.locale ?? 'unlocalized'})`
  )

  const activeCount = count(
    when([eq(entries.active, true), sql.value(1)], null)
  )
  const mainCount = count(when([eq(entries.main, true), sql.value(1)], null))
  const status = await db
    .select({
      id: entries.id,
      locale: entries.locale,
      activeCount,
      mainCount
    })
    .from(entries)
    .innerJoin(SyncAffected, eq(entries.id, SyncAffected.id))
    .groupBy(entries.id, entries.locale)
    .having(or(ne(activeCount, 1), ne(mainCount, 1)))
    .get()
  assert(
    !status,
    `Invalid derived status for ${status?.id} (${status?.locale ?? 'unlocalized'})`
  )

  const hierarchy = await db
    .select({id: entries.id, filePath: entries.filePath})
    .from(entries)
    .innerJoin(SyncAffected, eq(entries.id, SyncAffected.id))
    .where(
      sql<boolean>`exists (
        select 1 from json_each(${entries.parents}) parent
        where parent.value = ${entries.id}
      )`
    )
    .get()
  assert(!hierarchy, `Invalid entry hierarchy: ${hierarchy?.filePath}`)
}

async function copyInitialUrls(queries: SyncQueries): Promise<void> {
  await queries.copyInitialUrls.run()
}

/** Prepared, serialized source synchronization for one database connection. */
export class EntrySyncer implements AsyncDisposable {
  #db: Database
  #config: Config
  #queries = new Map<EntrySyncTarget, Promise<SyncQueries>>()
  #ready: Promise<void>
  #queue: Promise<unknown> = Promise.resolve()
  #closed = false

  constructor(config: Config, db: Database) {
    this.#config = config
    this.#db = db
    this.#ready = createTemporaryTables(this.#db)
  }

  /** Stream a source/tree diff directly into the canonical SQLite table. */
  sync(
    target: EntrySyncTarget,
    source: RemoteSource,
    tree: ReadonlyTree,
    fromRevision: string,
    options: EntrySyncOptions = {}
  ): Promise<Array<string>> {
    if (this.#closed) return Promise.reject(new Error('EntrySyncer is closed'))
    const task = this.#queue.then(() =>
      this.#sync(
        target,
        source,
        tree,
        fromRevision,
        options.previousTree,
        options.withinTransaction ?? false
      )
    )
    this.#queue = task.catch(() => {})
    return task
  }

  async #sync(
    target: EntrySyncTarget,
    source: RemoteSource,
    tree: ReadonlyTree,
    fromRevision: string,
    previousTree: ReadonlyTree | undefined,
    withinTransaction: boolean
  ): Promise<Array<string>> {
    const queries = await this.#queriesFor(target)
    const run = async (tx: Database) => {
      const materialized = new Set<string>()
      await clearTemporaryTables(queries)
      const state = await queries.revision.get()
      if (state?.revision !== fromRevision)
        throw new Error('Database revision mismatch')
      if (previousTree && previousTree.sha !== fromRevision)
        throw new Error('Cached tree revision mismatch')
      const initial = (await queries.entryCount.get())?.value === 0
      if (initial)
        await insertInitialSource(
          tx,
          target.entries,
          this.#config,
          source,
          tree,
          queries
        )
      else if (previousTree || state.tree)
        await mergeTrees(
          tx,
          target.entries,
          this.#config,
          source,
          previousTree ?? new ReadonlyTree(state.tree!),
          tree,
          queries
        )
      else
        await mergeSource(
          tx,
          target.entries,
          this.#config,
          source,
          tree,
          queries
        )
      await expandAffected(tx, target.entries)
      await materializeAffected(tx, target, queries, materialized)
      const hierarchyChanged = await deriveHierarchy(
        tx,
        target.entries,
        queries
      )
      if (hierarchyChanged) {
        await expandAffected(tx, target.entries)
        await materializeAffected(tx, target, queries, materialized)
      }
      await deriveStatus(tx, queries)
      if (initial) await copyInitialUrls(queries)
      else await deriveUrls(tx, target.entries, this.#config, queries)
      await validateEntries(tx, target.entries)
      const changed = await queries.changedIds.all()
      await queries.setRevision.run({
        revision: tree.sha,
        tree: target.changes ? null : JSON.stringify(tree)
      })
      return changed.map(row => row.id)
    }
    return withinTransaction
      ? run(this.#db)
      : this.#db.transaction(run, {async: true})
  }

  #queriesFor(target: EntrySyncTarget): Promise<SyncQueries> {
    const cached = this.#queries.get(target)
    if (cached) return cached
    const queries = this.#ready.then(() => prepareSyncQueries(this.#db, target))
    this.#queries.set(target, queries)
    return queries
  }

  /** Release prepared statements belonging to a closed named target. */
  async release(target: EntrySyncTarget): Promise<void> {
    await this.#queue
    const queries = this.#queries.get(target)
    if (!queries) return
    this.#queries.delete(target)
    await (await queries).free()
  }

  async close(): Promise<void> {
    if (this.#closed) return
    this.#closed = true
    await this.#queue
    await this.#ready
    await Promise.all(
      Array.from(this.#queries.values(), async queries =>
        (await queries).free()
      )
    )
    await dropTemporaryTables(this.#db)
  }

  [Symbol.asyncDispose](): Promise<void> {
    return this.close()
  }
}
