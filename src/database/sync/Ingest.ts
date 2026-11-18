import type {Config} from '#/core/Config.js'
import type {SyncOptions} from '#/core/db/LocalStore.js'
import {timeStep} from '#/core/db/SyncStats.js'
import {
  compareTrees,
  emptyTree,
  listFiles,
  type ObjectStore,
  type PathChange,
  type TreeChanges,
  type TreeMove
} from '@alinea/graft'
import type {Change} from '#/core/source/Change.js'
import {treeStore} from '#/core/source/TreeObjects.js'
import {compareStrings} from '#/core/source/Utils.js'
import type {RemoteSource} from '#/core/source/Source.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {chunks} from '#/core/util/Arrays.js'
import {assert} from '#/core/util/Assert.js'
import {parseEntryFilePath} from '#/core/util/EntryFilenames.js'
import {entryIndexRow} from '../entry/EntryTable.js'
import {parseSourceEntry} from './EntryParser.js'
import {insertEntryValues, type SyncQueries} from './SyncQueries.js'

/** Blob requests a large sync spreads its files over. */
const parallelParts = 4
/** Smaller syncs make fewer requests, of at least this many files. */
const minPartSize = 1000

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
  /** Versions moved along with a directory, whose url follows the move. */
  relocated: Set<string>
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
  await queries.deleteReferences.run(params)
  await queries.deleteFiles.run(params)
  return stored
}

function parseFiles(
  config: Config,
  dirSha: (path: string) => string,
  files: ReadonlyArray<FileRow>,
  blobs: ReadonlyMap<string, Uint8Array>
) {
  return files.map(file => {
    const blob = blobs.get(file.fileHash)
    assert(blob, `Source did not return blob ${file.fileHash}`)
    const entry = parseSourceEntry(config, file.filePath, file.fileHash, blob)
    return {
      ...entryIndexRow(entry),
      childrenSha: dirSha(entry.childrenDir),
      searchableText: entry.searchableText,
      references: entry.references
    }
  })
}

/** Record the source hash of every directory above a changed file. */
async function updateDirectoryHashes(
  queries: SyncQueries,
  dirSha: (path: string) => string,
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
    const childrenSha = dirSha(row.childrenDir)
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
  queries: SyncQueries,
  options: SyncOptions = {}
): Promise<SyncChanges> {
  const store = treeStore(previousTree, tree)
  const changes = await compareTrees(store, previousTree.sha, tree.sha)
  // The whole tree is at hand: it answers for any directory
  const dirSha = (path: string) => sourceDirectorySha(tree, path)
  return mergeChanges(
    config,
    source,
    {store, changes, dirSha},
    queries,
    options
  )
}

/** Two trees compared in a store, as graft's `compareTrees` gives them */
export interface StoreComparison {
  store: ObjectStore
  changes: TreeChanges
  /** The sha of a directory of the second tree, by default as compared */
  dirSha?(path: string): string
}

/** Write the changes of a tree comparison to the entry table. */
export async function mergeChanges(
  config: Config,
  source: RemoteSource,
  comparison: StoreComparison,
  queries: SyncQueries,
  {onProgress, stats}: SyncOptions = {}
): Promise<SyncChanges> {
  const changes: SyncChanges = {
    touched: new Set(),
    inserted: new Set(),
    parents: new Set(),
    childDirs: new Set(),
    containers: new Set(),
    relocated: new Set()
  }
  const {store, changes: compared} = comparison
  const {moves} = compared
  const dirSha =
    comparison.dirSha ??
    ((path: string) => compared.trees.get(path) ?? emptyTree)
  const diff = compared.files.flatMap(fileChange)
  // A directory moved whole keeps its files: their versions only change
  // paths, without reading or parsing them again
  for (const move of moves) {
    const relocated = await timeStep(stats, 'write', () =>
      relocate(config, queries, changes, move)
    )
    if (!relocated) diff.push(...(await expand(store, move)))
  }
  sortChanges(diff)
  const deleted = diff.flatMap(change =>
    change.op === 'delete' ? [change.path] : []
  )
  const added = diff.flatMap(change =>
    change.op === 'add' ? [{filePath: change.path, fileHash: change.sha}] : []
  )
  // A few large requests in parallel: every request to a serverless handler
  // pays for a sync of its own, so many small ones add up to seconds.
  const parts = Array.from(
    chunks(
      added,
      Math.max(minPartSize, Math.ceil(added.length / parallelParts))
    )
  )
  const requests = parts.map(files => [
    ...new Set(files.map(file => file.fileHash))
  ])
  const total = requests.reduce((sum, shas) => sum + shas.length, 0)
  let loaded = 0
  if (stats) stats.files += total
  if (total) onProgress?.({loaded, total})
  const reads = requests.map(shas => {
    const blobs = readBlobs(source, shas, () =>
      onProgress?.({loaded: ++loaded, total})
    )
    // A failed read is thrown once its part is written.
    blobs.catch(() => {})
    return blobs
  })
  if (deleted.length)
    await timeStep(stats, 'write', async () => {
      const stored = await removeVersions(queries, changes, deleted)
      const found = new Set(stored.map(row => row.filePath))
      for (const filePath of deleted)
        assert(found.has(filePath), `Missing version to delete: ${filePath}`)
    })
  for (const [index, files] of parts.entries()) {
    const blobs = await timeStep(stats, 'blobs', () => reads[index])
    const rows = await timeStep(stats, 'parse', () =>
      parseFiles(config, dirSha, files, blobs)
    )
    await timeStep(stats, 'write', () => writeRows(queries, changes, rows))
  }
  await timeStep(stats, 'write', () =>
    updateDirectoryHashes(
      queries,
      dirSha,
      [
        ...diff.map(change => change.path),
        ...moves.flatMap(move => [move.from, move.to])
      ],
      changes
    )
  )
  return changes
}

const contentModes = new Set(['100644', '100755'])

/** A file change as the index takes it: changed files are added again */
function fileChange(change: PathChange): Array<Change> {
  const entry = change.op === 'remove' ? change.before : change.after
  // Symlinks and submodules are not content
  if (!contentModes.has(entry.mode)) return []
  if (change.op === 'remove')
    return [{op: 'delete', path: change.path, sha: entry.sha}]
  return [{op: 'add', path: change.path, sha: entry.sha}]
}

/** The files a move removes and adds, for when it cannot be relocated */
async function expand(store: ObjectStore, move: TreeMove) {
  const files = await listFiles(store, move.sha)
  return [...files].flatMap(([path, entry]): Array<Change> => {
    if (!contentModes.has(entry.mode)) return []
    return [
      {op: 'delete', path: `${move.from}/${path}`, sha: entry.sha},
      {op: 'add', path: `${move.to}/${path}`, sha: entry.sha}
    ]
  })
}

/** Removals first, deepest first, then additions in path order. */
function sortChanges(changes: Array<Change>): void {
  changes.sort((a, b) => {
    if (a.op !== b.op) return a.op === 'delete' ? -1 : 1
    const order = compareStrings(a.path, b.path)
    return a.op === 'delete' ? -order : order
  })
}

/**
 * Point the versions stored below a moved directory at its new place. A
 * move into another workspace, root or locale changes more than paths, and
 * is left to parse again.
 */
async function relocate(
  config: Config,
  queries: SyncQueries,
  changes: SyncChanges,
  move: TreeMove
): Promise<boolean> {
  const rows = await queries.versionsBelow.all({
    from: `${move.from}/`,
    to: `${move.from}0`
  })
  const versions = Array<object>()
  for (const row of rows) {
    const filePath = move.to + row.filePath.slice(move.from.length)
    let location: ReturnType<typeof parseEntryFilePath>
    try {
      location = parseEntryFilePath(config, filePath)
    } catch {
      return false
    }
    const same =
      location.workspace === row.workspace &&
      location.root === row.root &&
      location.locale === row.locale &&
      location.path === row.path
    if (!same) return false
    const {parentDir, childrenDir, level} = location
    versions.push({
      versionId: row.versionId,
      filePath,
      parentDir,
      childrenDir,
      level,
      sourceRoot: level > 0 ? (parentDir.split('/').at(-level) ?? null) : null
    })
  }
  if (versions.length)
    await queries.relocateVersions.run({versions: JSON.stringify(versions)})
  for (const row of rows) changes.relocated.add(row.versionId)
  changes.childDirs.add(move.to)
  return true
}

async function writeRows(
  queries: SyncQueries,
  changes: SyncChanges,
  rows: ReturnType<typeof parseFiles>
): Promise<void> {
  await removeVersions(
    queries,
    changes,
    rows.map(row => row.filePath),
    rows.map(row => row.versionId)
  )
  const references = Array<[versionId: string, targetId: string]>()
  for (const row of rows) {
    await queries.insertEntry.run(insertEntryValues(row))
    await queries.insertSearch.run({
      title: row.title,
      body: row.searchableText
    })
    for (const target of row.references)
      references.push([row.versionId, target])
    changes.touched.add(row.id)
    changes.inserted.add(row.versionId)
    if (hasChildren(row.childrenSha)) changes.parents.add(row.id)
  }
  // A statement per row took a second for 20,000 entries.
  if (references.length)
    await queries.insertReferences.run({pairs: JSON.stringify(references)})
}

async function readBlobs(
  source: RemoteSource,
  shas: ReadonlyArray<string>,
  onBlob: () => void
): Promise<Map<string, Uint8Array>> {
  const blobs = new Map<string, Uint8Array>()
  for await (const [sha, blob] of source.getBlobs(shas)) {
    blobs.set(sha, blob)
    onBlob()
  }
  return blobs
}

function sourceDirectorySha(tree: ReadonlyTree, path: string): string {
  const node = tree.get(path)
  if (!node) return ReadonlyTree.EMPTY.sha
  assert(node instanceof ReadonlyTree, `Entry children path is a file: ${path}`)
  return node.sha
}
