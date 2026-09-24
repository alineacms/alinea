import {assert} from '../util/Assert.js'
import type {Change, ChangesBatch} from './Change.js'
import {compareTreeEntries, hashTree, serializeTreeEntries} from './GitUtils.js'
import {ShaMismatchError} from './ShaMismatchError.js'
import {compareStrings, splitPath} from './Utils.js'

export interface BaseEntry {
  sha: string
  mode: string
}

export interface FlatTreeEntry extends BaseEntry {
  type: string
  path: string
}

export interface FlatTree {
  sha: string
  tree: Array<FlatTreeEntry>
}

export interface Tree {
  sha: string
  entries: Array<Entry>
}

export interface Entry extends BaseEntry {
  name: string
  entries?: Array<Entry>
}

interface EntryNode extends Entry {
  entries: Array<Entry>
}

export class Leaf {
  readonly type = 'blob' as const
  readonly sha: string
  readonly mode: string

  constructor({sha, mode}: BaseEntry) {
    if (mode !== '100644' && mode !== '100755')
      throw new Error(`Invalid mode for leaf: ${mode}`)
    this.sha = sha
    this.mode = mode
    Object.freeze(this)
  }

  toJSON(): BaseEntry {
    return {...this}
  }
}

const EMPTY_TREE_SHA = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

class TreeBase<Node extends TreeBase<Node>> {
  readonly type = 'tree' as const
  readonly mode: string = '040000'
  sha: string | undefined
  protected nodes = new Map<string, Node | Leaf>()

  constructor(sha?: string) {
    this.sha = sha
  }

  get(path: string): Node | Leaf | undefined {
    const [name, rest] = splitPath(path)
    const named = this.nodes.get(name)
    if (!rest) return named
    if (named && !(named instanceof Leaf)) return named.get(rest)
  }

  getNode(path: string): Node {
    const entry = this.get(path)
    if (!entry) throw new Error(`Node not found: ${path}`)
    if (entry instanceof Leaf)
      throw new Error(`Expected node, found leaf: ${path}`)
    return entry
  }

  getLeaf(path: string): Leaf {
    const entry = this.get(path)
    if (!entry) throw new Error(`Leaf not found: ${path}`)
    if (!(entry instanceof Leaf))
      throw new Error(`Expected leaf, found node: ${path}`)
    return entry
  }

  has(path: string): boolean {
    const [name, rest] = splitPath(path)
    if (rest) {
      const target = this.nodes.get(name)
      if (!target || target instanceof Leaf) return false
      return target.has(rest)
    }
    return this.nodes.has(name)
  }

  *[Symbol.iterator](): IterableIterator<[string, Node | Leaf]> {
    for (const [name, entry] of this.nodes) {
      yield [name, entry] as const
      if (entry instanceof TreeBase)
        for (const [childName, child] of entry)
          yield [`${name}/${childName}`, child]
    }
  }

  *paths(): Iterable<string> {
    for (const [path] of this) yield path
  }

  index(): Map<string, string> {
    return new Map(this.fileIndex(''))
  }

  fileIndex(prefix: string) {
    return Array.from(this.nodes, ([key, entry]): Array<[string, string]> => {
      if (entry instanceof TreeBase) return entry.fileIndex(`${prefix}${key}/`)
      return [[prefix + key, entry.sha]]
    }).flat()
  }

  equals(other: ReadonlyTree | WriteableTree): boolean {
    if (other instanceof ReadonlyTree) return this.sha === other.sha
    const canCompare = this.sha && other.sha
    if (canCompare && this.sha === other.sha) return true
    if (this.nodes.size !== other.nodes.size) return false
    for (const [name, entry] of this.nodes) {
      const otherEntry = other.nodes.get(name)
      if (!otherEntry) return false
      if (entry instanceof Leaf) {
        if (!(otherEntry instanceof Leaf)) return false
        if (entry.sha !== otherEntry.sha) return false
      } else {
        if (!(otherEntry instanceof TreeBase)) return false
        if (!entry.equals(otherEntry)) return false
      }
    }
    return true
  }
}

export class ReadonlyTree extends TreeBase<ReadonlyTree> {
  readonly sha: string
  static readonly EMPTY = new ReadonlyTree({sha: EMPTY_TREE_SHA, entries: []})
  /** A path of every blob, by sha, indexed on first use. */
  #paths?: Map<string, string>

  constructor({sha, entries}: Tree) {
    super(sha)
    this.sha = sha
    for (const entry of entries.slice().sort(compareTreeEntries))
      this.nodes.set(
        entry.name,
        entry.entries ? new ReadonlyTree(entry as EntryNode) : new Leaf(entry)
      )
    Object.freeze(this)
  }

  /** A tree over built nodes, which it shares instead of copying. */
  static async fromNodes(
    nodes: Map<string, ReadonlyTree | Leaf>,
    sha?: string
  ): Promise<ReadonlyTree> {
    // Git sorts a directory, marked by its entries, as `name/`
    const entries = Array.from(nodes, ([name, node]): Entry => {
      const {mode, sha} = node
      return node instanceof Leaf
        ? {name, mode, sha}
        : {name, mode, sha, entries: []}
    }).sort(compareTreeEntries)
    const tree = new ReadonlyTree({
      sha: sha ?? (await hashTree(serializeTreeEntries(entries))),
      entries: []
    })
    // Freezing the tree leaves its node map writable
    for (const {name} of entries) tree.nodes.set(name, nodes.get(name)!)
    return tree
  }

  get isEmpty() {
    return this.sha === EMPTY_TREE_SHA
  }

  get entries(): Array<Entry> {
    return [...this.nodes.entries()].map(([name, entry]) => ({
      name,
      ...entry.toJSON()
    }))
  }

  /** A path holding the blob, if this tree has it. */
  pathOf(sha: string): string | undefined {
    if (!this.#paths) this.#indexPaths('', (this.#paths = new Map()))
    return this.#paths.get(sha)
  }

  #indexPaths(prefix: string, paths: Map<string, string>): void {
    for (const [name, node] of this.nodes)
      if (node instanceof Leaf) paths.set(node.sha, prefix + name)
      else node.#indexPaths(`${prefix}${name}/`, paths)
  }

  hasSha(sha: string): boolean {
    return this.pathOf(sha) !== undefined
  }

  /** A writable tree sharing these nodes until they change. */
  clone(): WriteableTree {
    const result = new WriteableTree()
    for (const [name, node] of this.nodes) result.add(name, node)
    result.sha = this.sha
    return result
  }

  toJSON() {
    return {sha: this.sha, mode: this.mode, entries: this.entries}
  }

  flat() {
    return {
      sha: this.sha,
      tree: this.#flatEntries('')
    }
  }

  withChanges(batch: ChangesBatch): Promise<ReadonlyTree> {
    const result = this.clone()
    result.applyChanges(batch)
    return result.compile()
  }

  #flatEntries(prefix: string): Array<FlatTreeEntry> {
    return Array.from(this.nodes, ([key, entry]): Array<FlatTreeEntry> => {
      const self: FlatTreeEntry = {
        type: entry.type,
        path: prefix + key,
        mode: entry.mode,
        sha: entry.sha
      }
      if (entry instanceof TreeBase)
        return [self].concat(entry.#flatEntries(`${prefix}${key}/`))
      return [self]
    }).flat()
  }

  static fromFlat(tree: FlatTree): ReadonlyTree {
    const entries = Array<Entry>()
    const nodes = new Map<string, Entry>()
    for (const {path, mode, sha} of tree.tree) {
      const lastSlash = path.lastIndexOf('/')
      const dir = lastSlash === -1 ? '' : path.slice(0, lastSlash)
      const name = lastSlash === -1 ? path : path.slice(lastSlash + 1)
      const node = {name, mode, sha}
      nodes.set(path, node)
      if (dir) {
        const parent = nodes.get(dir)
        assert(parent, `Parent not found: ${dir}`)
        if (!parent.entries) parent.entries = []
        parent.entries.push(node)
      } else {
        entries.push(node)
      }
    }
    return new ReadonlyTree({sha: tree.sha, entries})
  }

  // Todo: check modes
  diff(that: ReadonlyTree | WriteableTree): ChangesBatch {
    if (!(that instanceof ReadonlyTree)) return this.#flatDiff(that)
    const changes = Array.from(this.#changes(that, '')).sort((a, b) => {
      if (a.op !== b.op) return a.op === 'delete' ? -1 : 1
      const order = compareStrings(a.path, b.path)
      return a.op === 'delete' ? -order : order
    })
    return {
      fromSha: this.sha,
      changes
    }
  }

  *#changes(that: ReadonlyTree, prefix: string): Generator<Change> {
    if (this.sha === that.sha) return
    const names = Array.from(
      new Set([...this.nodes.keys(), ...that.nodes.keys()])
    ).sort(compareStrings)
    for (const name of names) {
      const path = prefix ? `${prefix}/${name}` : name
      const local = this.nodes.get(name)
      const remote = that.nodes.get(name)
      if (!local) {
        yield* this.#files(remote!, path, 'add')
      } else if (!remote) {
        yield* this.#files(local, path, 'delete')
      } else if (local.sha === remote.sha) {
        continue
      } else if (
        local instanceof ReadonlyTree &&
        remote instanceof ReadonlyTree
      ) {
        yield* local.#changes(remote, path)
      } else if (local instanceof Leaf && remote instanceof Leaf) {
        yield {op: 'add', path, sha: remote.sha}
      } else {
        yield* this.#files(local, path, 'delete')
        yield* this.#files(remote, path, 'add')
      }
    }
  }

  *#files(
    node: ReadonlyTree | Leaf,
    path: string,
    op: Change['op']
  ): Generator<Change> {
    if (node instanceof Leaf) {
      yield {op, path, sha: node.sha}
      return
    }
    for (const name of Array.from(node.nodes.keys()).sort(compareStrings))
      yield* this.#files(node.nodes.get(name)!, `${path}/${name}`, op)
  }

  #flatDiff(that: ReadonlyTree | WriteableTree): ChangesBatch {
    const local = this.index()
    const remote = that.index()
    const changes = Array<Change>()
    const paths = new Set(
      [...local.keys(), ...remote.keys()].sort(compareStrings)
    )
    for (const path of paths) {
      const localValue = local.get(path)
      const remoteValue = remote.get(path)
      if (localValue === remoteValue) continue
      if (remoteValue === undefined)
        changes.unshift({op: 'delete', path, sha: localValue!})
      else changes.push({op: 'add', path, sha: remoteValue})
    }
    return {fromSha: this.sha, changes}
  }
}

/** A mutable tree, which copies shared readonly subtrees once they change. */
export class WriteableTree extends TreeBase<WriteableTree | ReadonlyTree> {
  constructor({sha, entries}: Tree = {sha: EMPTY_TREE_SHA, entries: []}) {
    super(sha)
    for (const entry of entries) {
      this.nodes.set(
        entry.name,
        entry.entries ? new WriteableTree(entry as EntryNode) : new Leaf(entry)
      )
    }
  }

  add(path: string, input: WriteableTree | ReadonlyTree | Leaf | string): void {
    this.sha = undefined
    const [name, rest] = splitPath(path)
    if (rest) {
      this.#writable(name, true)!.add(rest, input)
    } else {
      const node =
        typeof input === 'string'
          ? new Leaf({
              sha: input,
              mode: '100644'
            })
          : input instanceof WriteableTree
            ? input.clone()
            : input
      this.nodes.set(name, node)
    }
  }

  /** The writable subtree at a name, copied first if it is shared. */
  #writable(name: string, create: boolean): WriteableTree | undefined {
    const node = this.nodes.get(name)
    if (node instanceof WriteableTree) return node
    if (node instanceof Leaf)
      throw new Error(`Expected node, found leaf: ${name}`)
    if (!node && !create) return undefined
    const writable = node ? node.clone() : new WriteableTree()
    this.nodes.set(name, writable)
    return writable
  }

  remove(path: string): boolean {
    this.sha = undefined
    const [name, rest] = splitPath(path)
    if (!rest) return this.nodes.delete(name)
    const target = this.#writable(name, false)
    if (!target) return false
    const result = target.remove(rest)
    if (target.nodes.size === 0) this.nodes.delete(name)
    return result
  }

  rename(from: string, to: string): void {
    const entry = this.get(from)
    if (!entry) return
    this.remove(from)
    this.add(to, entry)
  }

  applyChanges(batch: ChangesBatch): void {
    const {fromSha, changes} = batch
    if (this.sha && this.sha !== fromSha)
      throw new ShaMismatchError(fromSha, this.sha)
    for (const change of changes) {
      switch (change.op) {
        case 'delete': {
          const existing = this.get(change.path)
          if (!existing) continue
          assert(existing instanceof Leaf, `Cannot delete: ${change.path}`)
          assert(
            existing.sha === change.sha,
            `SHA mismatch: ${existing.sha} !== ${change.sha} for ${change.path}`
          )
          this.remove(change.path)
          continue
        }
        case 'add': {
          const existing = this.get(change.path)
          if (existing && existing.sha === change.sha) continue
          this.add(change.path, change.sha)
          continue
        }
      }
    }
  }

  async getSha(): Promise<string> {
    return (await this.compile()).sha
  }

  /** Compile, reusing the nodes of a previous tree wherever they are equal. */
  async compile(previous?: ReadonlyTree): Promise<ReadonlyTree> {
    if (previous?.equals(this)) return previous
    const nodes = new Map<string, ReadonlyTree | Leaf>()
    for (const [name, node] of this.nodes) {
      const before = previous?.get(name)
      const compiled =
        node instanceof WriteableTree
          ? await node.compile(
              before instanceof ReadonlyTree ? before : undefined
            )
          : node
      // We probably should not allow an empty tree to be added in the
      // first place
      if (compiled instanceof Leaf || !compiled.isEmpty)
        nodes.set(name, compiled)
    }
    const tree = await ReadonlyTree.fromNodes(nodes, this.sha)
    this.sha = tree.sha
    return tree
  }

  clone(): WriteableTree {
    const result = new WriteableTree()
    for (const [name, entry] of this.nodes) result.add(name, entry)
    result.sha = this.sha
    return result
  }
}
