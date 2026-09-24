import type {Config} from '#/core/Config.js'
import type {RemoteSource} from '#/core/source/Source.js'
import {Leaf, ReadonlyTree} from '#/core/source/Tree.js'
import {chunks} from '#/core/util/Arrays.js'
import {assert} from '#/core/util/Assert.js'
import {entryIndexRow, type IndexedEntry} from '../entry/EntryTable.js'
import {parseSourceEntry} from './EntryParser.js'
import {insertEntryValues, type SyncQueries} from './SyncQueries.js'

const changeBatchSize = 250

/** What merging a source tree into the entry table changed. */
export interface SyncChanges {
  /** Entries with a version that was added, replaced or removed. */
  touched: Set<string>
  /** Versions written from their source file, with the url parsed from it. */
  inserted: Set<string>
  /** Entries with a touched version that has children: those inherit from it. */
  parents: Set<string>
  /** Child directories of removed or replaced versions that had children. */
  childDirs: Set<string>
  /** Entries whose child directory changed in the source tree. */
  containers: Set<string>
}

interface FileRow {
  filePath: string
  fileHash: string
}

/** Whether a directory hash stands for a directory with files. */
export function hasChildren(childrenSha: string | null): boolean {
  return Boolean(childrenSha) && childrenSha !== ReadonlyTree.EMPTY.sha
}

/** Delete the versions stored at these paths or under these version ids. */
async function removeVersions(
  queries: SyncQueries,
  changes: SyncChanges,
  filePaths: ReadonlyArray<string>,
  versionIds: ReadonlyArray<string> = []
) {
  const params = {
    filePaths: JSON.stringify(filePaths),
    versionIds: JSON.stringify(versionIds)
  }
  const stored = await queries.storedFiles.all(params)
  for (const row of stored) {
    changes.touched.add(row.id)
    if (!hasChildren(row.childrenSha)) continue
    changes.parents.add(row.id)
    changes.childDirs.add(row.childrenDir)
  }
  await queries.deleteSearch.run(params)
  await queries.deleteFiles.run(params)
  return stored
}

async function parseFiles(
  config: Config,
  source: RemoteSource,
  tree: ReadonlyTree,
  files: ReadonlyArray<FileRow>
) {
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
  return parsedEntries.map(entry => ({
    ...entryIndexRow(entry),
    childrenSha: sourceDirectorySha(tree, entry.childrenDir),
    searchableText: entry.searchableText
  }))
}

/** Record the source hash of every directory above a changed file. */
async function updateDirectoryHashes(
  queries: SyncQueries,
  tree: ReadonlyTree,
  filePaths: ReadonlyArray<string>,
  changes: SyncChanges
): Promise<void> {
  const directories = new Set<string>()
  for (const filePath of filePaths) {
    let slash = filePath.lastIndexOf('/')
    while (slash !== -1) {
      directories.add(filePath.slice(0, slash))
      slash = filePath.lastIndexOf('/', slash - 1)
    }
  }
  if (!directories.size) return
  const rows = await queries.directories.all({
    dirs: JSON.stringify(Array.from(directories))
  })
  const changed = new Map<string, string>()
  for (const row of rows) {
    const childrenSha = sourceDirectorySha(tree, row.childrenDir)
    if (childrenSha === row.childrenSha) continue
    changes.containers.add(row.id)
    changed.set(row.childrenDir, childrenSha)
  }
  for (const [dir, sha] of changed)
    await queries.updateChildrenSha.run({dir, sha})
}

/** Write the files that differ between two source trees to the entry table. */
export async function mergeTrees(
  config: Config,
  source: RemoteSource,
  previousTree: ReadonlyTree,
  tree: ReadonlyTree,
  queries: SyncQueries
): Promise<SyncChanges> {
  const changes: SyncChanges = {
    touched: new Set(),
    inserted: new Set(),
    parents: new Set(),
    childDirs: new Set(),
    containers: new Set()
  }
  const diff = previousTree.diff(tree).changes
  for (const batch of chunks(diff, changeBatchSize)) {
    const deleted = batch.flatMap(change =>
      change.op === 'delete' ? [change.path] : []
    )
    if (deleted.length) {
      const stored = await removeVersions(queries, changes, deleted)
      const found = new Set(stored.map(row => row.filePath))
      for (const filePath of deleted)
        assert(found.has(filePath), `Missing version to delete: ${filePath}`)
    }
    const added = batch.flatMap(change =>
      change.op === 'add' ? [{filePath: change.path, fileHash: change.sha}] : []
    )
    if (!added.length) continue
    const rows = await parseFiles(config, source, tree, added)
    await removeVersions(
      queries,
      changes,
      rows.map(row => row.filePath),
      rows.map(row => row.versionId)
    )
    for (const row of rows) {
      await queries.insertEntry.run(insertEntryValues(row))
      await queries.insertSearch.run({
        title: row.title,
        body: row.searchableText
      })
      changes.touched.add(row.id)
      changes.inserted.add(row.versionId)
      if (hasChildren(row.childrenSha)) changes.parents.add(row.id)
    }
  }
  await updateDirectoryHashes(
    queries,
    tree,
    diff.map(change => change.path),
    changes
  )
  return changes
}

function sourceDirectorySha(tree: ReadonlyTree, path: string): string {
  const node = tree.get(path)
  if (!node) return ReadonlyTree.EMPTY.sha
  assert(!(node instanceof Leaf), `Entry children path is a file: ${path}`)
  return node.sha
}
