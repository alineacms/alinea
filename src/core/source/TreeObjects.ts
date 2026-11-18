import type {GitObject, ObjectStore, StoredObject} from '@alinea/graft'
import {parseTreeEntries, serializeTreeEntries} from './GitUtils.js'
import type {GetBlobsOptions, RemoteSource} from './Source.js'
import {ReadonlyTree, type Entry} from './Tree.js'

/** The whole tree at `sha` in alinea's form, read a level at a time. */
export async function readTree(
  objects: ObjectStore,
  sha: string
): Promise<ReadonlyTree> {
  const trees = new Map<string, Array<Entry>>([[ReadonlyTree.EMPTY.sha, []]])
  let level = sha === ReadonlyTree.EMPTY.sha ? [] : [sha]
  while (level.length > 0) {
    const found = await objects.get(level)
    for (const sha of level) {
      const object = found.get(sha)
      if (object?.type !== 'tree') throw new Error(`Missing tree ${sha}`)
      // Symlinks and submodules are not content
      trees.set(
        sha,
        parseTreeEntries(object.data).filter(
          entry =>
            entry.mode === '040000' ||
            entry.mode === '100644' ||
            entry.mode === '100755'
        )
      )
    }
    level = [
      ...new Set(
        level.flatMap(sha =>
          trees
            .get(sha)!
            .filter(entry => entry.mode === '040000' && !trees.has(entry.sha))
            .map(entry => entry.sha)
        )
      )
    ]
  }
  const build = (sha: string): Array<Entry> =>
    trees.get(sha)!.map(entry =>
      entry.mode === '040000'
        ? {
            name: entry.name,
            mode: '040000',
            sha: entry.sha,
            entries: build(entry.sha)
          }
        : {name: entry.name, mode: entry.mode, sha: entry.sha}
    )
  return new ReadonlyTree({sha, entries: build(sha)})
}

/**
 * In-memory trees as a store of their directories, read as a comparison
 * reaches them, for graft's tree functions. It holds no blobs.
 */
export function treeStore(...roots: Array<ReadonlyTree>): ObjectStore {
  const bySha = new Map<string, ReadonlyTree>()
  for (const root of roots) bySha.set(root.sha, root)
  const object = (tree: ReadonlyTree): GitObject => {
    const entries = Array<Entry>()
    for (const [name, child] of tree.children()) {
      // Git sorts a directory, marked by its entries, as `name/`
      if (child instanceof ReadonlyTree) {
        bySha.set(child.sha, child)
        entries.push({name, mode: child.mode, sha: child.sha, entries: []})
      } else entries.push({name, mode: child.mode, sha: child.sha})
    }
    return {type: 'tree', data: serializeTreeEntries(entries)}
  }
  return {
    async get(shas) {
      const result = new Map<string, GitObject>()
      for (const sha of shas) {
        const tree = bySha.get(sha)
        if (tree) result.set(sha, object(tree))
      }
      return result
    },
    async has(shas) {
      return new Set(shas.filter(sha => bySha.has(sha)))
    },
    async put() {
      throw new Error('In-memory trees are read only')
    }
  }
}

/** The directories of a tree as git tree objects. */
export function treeObjects(tree: ReadonlyTree): Array<StoredObject> {
  const result = Array<StoredObject>()
  const add = (node: ReadonlyTree) => {
    const entries = Array<Entry>()
    for (const [name, child] of node.children())
      entries.push(
        child instanceof ReadonlyTree
          ? {name, mode: child.mode, sha: child.sha, entries: []}
          : {name, mode: child.mode, sha: child.sha}
      )
    result.push({
      sha: node.sha,
      type: 'tree',
      data: serializeTreeEntries(entries)
    })
    for (const [, child] of node.children())
      if (child instanceof ReadonlyTree) add(child)
  }
  add(tree)
  return result
}

/** Blobs read from git objects, for a sync from them. */
export function objectBlobs(objects: ObjectStore): RemoteSource {
  return {
    async getTreeIfDifferent() {
      throw new Error('Object blobs have no tree')
    },
    async *getBlobs(shas: ReadonlyArray<string>, options?: GetBlobsOptions) {
      const found = await objects.get(shas)
      if (options?.signal?.aborted)
        throw options.signal.reason ?? new Error('Blob transfer aborted')
      for (const sha of shas) {
        const object = found.get(sha)
        if (object?.type === 'blob') yield [sha, object.data] as const
      }
    }
  }
}
