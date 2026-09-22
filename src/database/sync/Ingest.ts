import type {Config} from '#/core/Config.js'
import type {RemoteSource} from '#/core/source/Source.js'
import {Leaf, ReadonlyTree} from '#/core/source/Tree.js'
import {chunks} from '#/core/util/Arrays.js'
import {assert} from '#/core/util/Assert.js'
import {inArray, or, type Database} from 'rado'
import {
  entryIndexRow,
  type EntryIndexTarget,
  type IndexedEntry
} from '../entry/EntryTable.js'
import {parseSourceEntry} from './EntryParser.js'
import {
  changeBatchSize,
  sqliteBatchSize,
  SyncAffected,
  SyncCascade,
  SyncValues,
  type AffectedEntryRow,
  type DirectoryHashRow,
  type FileRow,
  type StoredHierarchyRow,
  type SyncQueries
} from './SyncQueries.js'

async function markAffected(
  db: Database,
  entries: EntryIndexTarget,
  filePaths: ReadonlyArray<string>,
  versionIds: ReadonlyArray<string> = []
): Promise<Array<AffectedEntryRow>> {
  if (!filePaths.length && !versionIds.length) return []
  const existing = (await db
    .select({
      id: entries.id,
      filePath: entries.filePath,
      childrenSha: entries.childrenSha
    })
    .from(entries)
    .where(
      or(
        filePaths.length
          ? inArray(entries.filePath, Array.from(filePaths))
          : undefined,
        versionIds.length
          ? inArray(entries.versionId, Array.from(versionIds))
          : undefined
      )
    )) as Array<AffectedEntryRow>
  await markRows(db, existing)
  return existing
}

interface MarkableRow {
  id: string
  childrenSha?: string | null
}

/** Flag these entries as affected, and cascade into their children. */
async function markRows(
  db: Database,
  rows: ReadonlyArray<MarkableRow>
): Promise<void> {
  await addIds(
    db,
    SyncAffected,
    rows.map(row => row.id)
  )
  await addIds(
    db,
    SyncCascade,
    rows.flatMap(row =>
      row.childrenSha && row.childrenSha !== ReadonlyTree.EMPTY.sha
        ? [row.id]
        : []
    )
  )
}

async function addIds(
  db: Database,
  table: typeof SyncAffected | typeof SyncCascade,
  ids: Iterable<string>
): Promise<void> {
  const unique = Array.from(new Set(ids))
  if (!unique.length) return
  const existing = await db
    .select({id: table.id})
    .from(table)
    .where(inArray(table.id, unique))
  const present = new Set(existing.map(row => row.id))
  const missing = unique.filter(id => !present.has(id))
  if (missing.length) await db.insert(table).values(missing.map(id => ({id})))
}

async function deleteFiles(
  db: Database,
  entries: EntryIndexTarget,
  filePaths: ReadonlyArray<string>
): Promise<void> {
  if (!filePaths.length) return
  const existing = await markAffected(db, entries, filePaths)
  const found = new Set(existing.map(row => row.filePath))
  for (const filePath of filePaths)
    assert(found.has(filePath), `Missing version to delete: ${filePath}`)
  await db
    .delete(entries)
    .where(inArray(entries.filePath, Array.from(filePaths)))
}

async function replaceFiles(
  db: Database,
  entries: EntryIndexTarget,
  config: Config,
  source: RemoteSource,
  tree: ReadonlyTree,
  files: ReadonlyArray<FileRow>,
  queries: SyncQueries
): Promise<void> {
  if (!files.length) return
  const pathsByHash = new Map<string, Array<string>>()
  for (const file of files) {
    const paths = pathsByHash.get(file.fileHash) ?? []
    paths.push(file.filePath)
    pathsByHash.set(file.fileHash, paths)
  }
  const parsedEntries = Array<IndexedEntry>()
  const found = new Set<string>()
  for await (const [fileHash, blob] of source.getBlobs([
    ...pathsByHash.keys()
  ])) {
    const paths = pathsByHash.get(fileHash)
    if (!paths) continue
    found.add(fileHash)
    for (const filePath of paths)
      parsedEntries.push(parseSourceEntry(config, filePath, fileHash, blob))
  }
  for (const fileHash of pathsByHash.keys())
    assert(found.has(fileHash), `Source did not return blob ${fileHash}`)
  const rows = parsedEntries.map(entry => ({
    ...entryIndexRow(entry),
    childrenSha: sourceDirectorySha(tree, entry.childrenDir)
  }))
  const filePaths = rows.map(row => row.filePath)
  const versionIds = rows.map(row => row.versionId)
  const previous = (await db
    .select({
      versionId: entries.versionId,
      parentDir: entries.parentDir,
      parentId: entries.parentId,
      parents: entries.parents
    })
    .from(entries)
    .where(
      or(
        inArray(entries.filePath, filePaths),
        inArray(entries.versionId, versionIds)
      )
    )) as Array<StoredHierarchyRow>
  const previousByVersion = new Map(previous.map(row => [row.versionId, row]))
  for (const row of rows) {
    const stored = previousByVersion.get(row.versionId)
    if (!stored || stored.parentDir !== row.parentDir) continue
    row.parentId = stored.parentId
    row.parents = stored.parents
  }
  await markAffected(db, entries, filePaths, versionIds)
  await db
    .delete(entries)
    .where(
      or(
        inArray(entries.filePath, filePaths),
        inArray(entries.versionId, versionIds)
      )
    )
  // Named parameters bypass column encoders, so bind SQLite values explicitly.
  for (const row of rows)
    await queries.insertEntry.run({
      ...row,
      parents: JSON.stringify(row.parents),
      active: Number(row.active),
      main: Number(row.main),
      visible: Number(row.visible)
    })
  await markRows(db, rows)
}

async function updateDirectoryHashes(
  db: Database,
  entries: EntryIndexTarget,
  tree: ReadonlyTree,
  queries: SyncQueries,
  filePaths: ReadonlyArray<string>
): Promise<void> {
  const directories = new Set(
    filePaths.flatMap(filePath => {
      const result = Array<string>()
      let slash = filePath.lastIndexOf('/')
      while (slash !== -1) {
        result.push(filePath.slice(0, slash))
        slash = filePath.lastIndexOf('/', slash - 1)
      }
      return result
    })
  )
  for (const paths of chunks(Array.from(directories), sqliteBatchSize)) {
    const rows = (await db
      .select({
        id: entries.id,
        versionId: entries.versionId,
        childrenDir: entries.childrenDir,
        childrenSha: entries.childrenSha
      })
      .from(entries)
      .where(inArray(entries.childrenDir, paths))) as Array<DirectoryHashRow>
    const changed = rows.filter(row => {
      const childrenSha = sourceDirectorySha(tree, row.childrenDir)
      return childrenSha !== row.childrenSha
    })
    if (!changed.length) continue
    await addIds(
      db,
      SyncAffected,
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

export async function mergeTrees(
  db: Database,
  entries: EntryIndexTarget,
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
      entries,
      batch.filter(change => change.op === 'delete').map(change => change.path)
    )
    await replaceFiles(
      db,
      entries,
      config,
      source,
      tree,
      batch.flatMap(change =>
        change.op === 'add'
          ? [{filePath: change.path, fileHash: change.sha}]
          : []
      ),
      queries
    )
  }
  await updateDirectoryHashes(
    db,
    entries,
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
