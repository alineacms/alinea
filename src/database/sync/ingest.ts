import type {Config} from '#/core/Config.js'
import type {RemoteSource} from '#/core/source/Source.js'
import {Leaf, ReadonlyTree} from '#/core/source/Tree.js'
import {assert} from '#/core/util/Assert.js'
import {inArray, or, type Database} from 'rado'
import {
  entryIndexRow,
  type EntryIndexTarget,
  type IndexedEntry
} from '../entry/Schema.js'
import {parseSourceEntry} from './EntryParser.js'
import {
  changeBatchSize,
  chunks,
  sqliteBatchSize,
  SyncAffected,
  SyncCascade,
  SyncValues,
  type AffectedEntryRow,
  type DirectoryHashRow,
  type FileRow,
  type StoredFileRow,
  type StoredHierarchyRow,
  type SyncQueries
} from './queries.js'

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
  await addIds(
    db,
    SyncAffected,
    existing.map(row => row.id)
  )
  await addIds(
    db,
    SyncCascade,
    existing.flatMap(row =>
      row.childrenSha && row.childrenSha !== ReadonlyTree.EMPTY.sha
        ? [row.id]
        : []
    )
  )
  return existing
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

export async function insertInitialSource(
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
  while (true) {
    const rows = (await queries.storedFiles.all({
      afterFilePath
    })) as Array<StoredFileRow>
    if (!rows.length) return
    for (const row of rows) yield row
    afterFilePath = rows.at(-1)!.filePath
  }
}

export async function mergeSource(
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
      await addIds(db, SyncAffected, directoryIds)
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

async function updateDirectoryHashes(
  db: Database,
  EntryIndexTable: EntryIndexTarget,
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
