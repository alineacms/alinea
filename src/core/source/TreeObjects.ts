import type {ObjectStore, StoredObject} from '@alinea/graft'
import type {TreeItem, TreeReader} from './CompareTrees.js'
import {parseTreeEntries, serializeTreeEntries} from './GitUtils.js'
import type {GetBlobsOptions, RemoteSource} from './Source.js'
import {ReadonlyTree, type Entry} from './Tree.js'

/** Reads directories from git objects, such as a graft store holds. */
export function objectReader(objects: ObjectStore): TreeReader {
  return async shas => {
    const found = await objects.get([...new Set(shas)])
    const result = new Map<string, Array<TreeItem>>()
    for (const [sha, object] of found) {
      if (object.type !== 'tree') continue
      result.set(
        sha,
        parseTreeEntries(object.data).flatMap(entry => {
          const tree = entry.mode === '040000'
          // Symlinks and submodules are not content
          if (!tree && entry.mode !== '100644' && entry.mode !== '100755')
            return []
          return [{name: entry.name, sha: entry.sha, tree}]
        })
      )
    }
    if (shas.includes(ReadonlyTree.EMPTY.sha))
      result.set(ReadonlyTree.EMPTY.sha, [])
    return result
  }
}

/** The whole tree at `sha`, read a level at a time. */
export async function readTree(
  read: TreeReader,
  sha: string
): Promise<ReadonlyTree> {
  const trees = new Map<string, ReadonlyArray<TreeItem>>()
  let level = [sha]
  while (level.length > 0) {
    const found = await read(level)
    for (const sha of level)
      if (!found.has(sha)) throw new Error(`Missing tree ${sha}`)
    for (const [sha, items] of found) trees.set(sha, items)
    level = [...found.values()]
      .flat()
      .filter(item => item.tree && !trees.has(item.sha))
      .map(item => item.sha)
  }
  const build = (sha: string): Array<Entry> =>
    trees.get(sha)!.map(item =>
      item.tree
        ? {
            name: item.name,
            mode: '040000',
            sha: item.sha,
            entries: build(item.sha)
          }
        : {name: item.name, mode: '100644', sha: item.sha}
    )
  return new ReadonlyTree({sha, entries: build(sha)})
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
