import {assert} from '../util/Assert.js'
import type {Change} from './Change.js'
import {ReadonlyTree} from './Tree.js'
import {compareStrings} from './Utils.js'

/** A name in a directory: a file, or a directory when `tree` is set. */
export interface TreeItem {
  name: string
  sha: string
  tree: boolean
}

/** Reads directories by sha, all of them in one batch. */
export type TreeReader = (
  shas: ReadonlyArray<string>
) => Promise<Map<string, ReadonlyArray<TreeItem>>>

/** A directory found whole at another path. */
export interface TreeMove {
  from: string
  to: string
  sha: string
}

export interface TreeComparison {
  /** Files added or changed, as adds, and files removed. */
  changes: Array<Change>
  /** Directories of the old tree found whole at another path. */
  moves: Array<TreeMove>
  /**
   * The sha of a directory of the new tree, the empty tree for one that is
   * missing. Answers for a path in a directory the comparison read: one
   * holding a change, or a move, or the parent of an entry's directory.
   */
  dirSha(path: string): string
  /** The files a move removes and adds, for when it cannot be relocated. */
  expand(move: TreeMove): Promise<Array<Change>>
  /** Directories of the new tree the comparison read, but not those moved. */
  read: Set<string>
  /** The old sha of a directory or file changed in place, by its new sha. */
  previous: Map<string, string>
  /** Shas the old tree lists in the directories the comparison read. */
  known: Set<string>
}

interface Pair {
  path: string
  a: string
  b: string
}

/**
 * The changes from tree `a` to tree `b`. Directories with one sha on both
 * sides are skipped without being read, the others are read a level at a
 * time. A directory removed from one place and added at another with the
 * same sha is a move, which the caller can relocate without reading it.
 */
export async function compareTrees(
  read: TreeReader,
  a: string,
  b: string
): Promise<TreeComparison> {
  const changes = Array<Change>()
  const shaByPath = new Map<string, string>()
  const visited = new Set<string>()
  const previous = new Map<string, string>()
  const known = new Set<string>()
  const readTrees = new Set<string>()
  const removed = new Map<string, Array<string>>()
  const added = Array<{path: string; sha: string}>()
  const list = (items: ReadonlyArray<TreeItem>) =>
    new Map(items.map(item => [item.name, item]))
  const join = (dir: string, name: string) => (dir ? `${dir}/${name}` : name)

  /** Every file below a directory, for its removal or addition. */
  async function files(
    path: string,
    sha: string,
    op: Change['op'],
    onTree?: (path: string, sha: string) => boolean
  ): Promise<Array<Change>> {
    const result = Array<Change>()
    let level = [{path, sha}]
    while (level.length > 0) {
      const trees = await read(level.map(dir => dir.sha))
      const next = Array<{path: string; sha: string}>()
      for (const dir of level) {
        if (op === 'add') {
          visited.add(dir.path)
          readTrees.add(dir.sha)
        }
        for (const item of trees.get(dir.sha) ?? missing(dir.sha)) {
          const itemPath = join(dir.path, item.name)
          if (op === 'add') shaByPath.set(itemPath, item.sha)
          if (!item.tree) result.push({op, path: itemPath, sha: item.sha})
          else if (!onTree?.(itemPath, item.sha))
            next.push({path: itemPath, sha: item.sha})
        }
      }
      level = next
    }
    return result
  }

  let level: Array<Pair> = a === b ? [] : [{path: '', a, b}]
  while (level.length > 0) {
    const trees = await read(level.flatMap(pair => [pair.a, pair.b]))
    const next = Array<Pair>()
    for (const pair of level) {
      const left = list(trees.get(pair.a) ?? missing(pair.a))
      const right = list(trees.get(pair.b) ?? missing(pair.b))
      visited.add(pair.path)
      readTrees.add(pair.b)
      for (const item of left.values()) known.add(item.sha)
      for (const name of new Set([...left.keys(), ...right.keys()])) {
        const path = join(pair.path, name)
        const x = left.get(name)
        const y = right.get(name)
        if (y) shaByPath.set(path, y.sha)
        if (x && y && x.sha === y.sha && x.tree === y.tree) continue
        if (x?.tree && y?.tree) {
          previous.set(y.sha, x.sha)
          next.push({path, a: x.sha, b: y.sha})
          continue
        }
        if (x?.tree) removed.set(x.sha, [...(removed.get(x.sha) ?? []), path])
        else if (x && (!y || y.tree))
          changes.push({op: 'delete', path, sha: x.sha})
        if (y?.tree) added.push({path, sha: y.sha})
        else if (y) {
          changes.push({op: 'add', path, sha: y.sha})
          if (x) previous.set(y.sha, x.sha)
        }
      }
    }
    level = next
  }

  // Added directories found removed elsewhere moved there, also when nested
  // in a directory added around them
  const moves = Array<TreeMove>()
  const moveTo = (to: string, sha: string) => {
    const from = removed.get(sha)?.shift()
    if (from === undefined) return false
    moves.push({from, to, sha})
    return true
  }
  for (const {path, sha} of added)
    if (!moveTo(path, sha))
      changes.push(...(await files(path, sha, 'add', moveTo)))
  for (const [sha, paths] of removed)
    for (const path of paths)
      changes.push(...(await files(path, sha, 'delete')))

  return {
    changes: sortChanges(changes),
    moves,
    dirSha(path) {
      const slash = path.lastIndexOf('/')
      const dir = slash === -1 ? '' : path.slice(0, slash)
      assert(visited.has(dir), `Directory not compared: ${dir}`)
      return shaByPath.get(path) ?? ReadonlyTree.EMPTY.sha
    },
    async expand(move) {
      return sortChanges([
        ...(await files(move.from, move.sha, 'delete')),
        ...(await files(move.to, move.sha, 'add'))
      ])
    },
    read: readTrees,
    previous,
    known
  }
}

function missing(sha: string): never {
  throw new Error(`Missing tree ${sha}`)
}

/** Removals first, deepest first, then additions in path order. */
function sortChanges(changes: Array<Change>): Array<Change> {
  return changes.sort((a, b) => {
    if (a.op !== b.op) return a.op === 'delete' ? -1 : 1
    const order = compareStrings(a.path, b.path)
    return a.op === 'delete' ? -order : order
  })
}

/** Reads the directories of in-memory trees, as a comparison reaches them. */
export function treeReader(...roots: Array<ReadonlyTree>): TreeReader {
  const bySha = new Map<string, ReadonlyTree>()
  for (const root of roots) bySha.set(root.sha, root)
  return async shas => {
    const result = new Map<string, Array<TreeItem>>()
    for (const sha of shas) {
      const tree = bySha.get(sha)
      if (!tree) continue
      const items = Array<TreeItem>()
      for (const [name, node] of tree.children()) {
        const isTree = node instanceof ReadonlyTree
        items.push({name, sha: node.sha, tree: isTree})
        if (isTree) bySha.set(node.sha, node)
      }
      result.set(sha, items)
    }
    return result
  }
}
