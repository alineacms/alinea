import type {Change} from './Change.js'
import {hashTree, serializeTreeEntries} from './GitUtils.js'
import {assert, compareStrings, splitPath} from './Utils.js'

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
  }

  clone(): Leaf {
    return this
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
    for (const [name, entry] of this.nodes) {
      yield name
      if (entry instanceof TreeBase)
        for (const path of entry.paths()) yield `${name}/${path}`
    }
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

  // Todo: check modes
  diff(that: TreeBase<any>): Array<Change> {
    const local = this.index()
    const remote = that.index()
    const changes: Array<Change> = []
    const paths = new Set(
      [...local.keys(), ...remote.keys()].sort(compareStrings)
    )
    for (const path of paths) {
      const localValue = local.get(path)
      const remoteValue = remote.get(path)
      if (localValue === remoteValue) continue
      if (remoteValue === undefined) {
        changes.unshift({op: 'delete', path, sha: localValue!})
      } else {
        changes.push({op: 'add', path, sha: remoteValue!})
      }
    }
    return changes
  }
}

export class ReadonlyTree extends TreeBase<ReadonlyTree> {
  readonly sha: string
  static readonly EMPTY = new ReadonlyTree({sha: EMPTY_TREE_SHA, entries: []})
  #shas = new Set<string>()

  constructor({sha, entries}: Tree) {
    super(sha)
    this.sha = sha
    for (const entry of entries) {
      const node = entry.entries
        ? new ReadonlyTree(entry as EntryNode)
        : new Leaf(entry)
      if (node instanceof Leaf) this.#shas.add(node.sha)
      else for (const sha of node.#shas) this.#shas.add(sha)
      this.nodes.set(entry.name, node)
    }
  }

  get entries(): Array<Entry> {
    return [...this.nodes.entries()].map(([name, entry]) => ({
      name,
      ...entry.toJSON()
    }))
  }

  hasSha(sha: string): boolean {
    return this.#shas.has(sha)
  }

  clone(): WriteableTree {
    return new WriteableTree({
      sha: this.sha,
      entries: this.entries
    })
  }

  equals(other: ReadonlyTree) {
    return this.sha === other.sha
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

  withChanges(changes: Array<Change>): Promise<ReadonlyTree> {
    const result = this.clone()
    result.applyChanges(changes)
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
}

export class WriteableTree extends TreeBase<WriteableTree> {
  constructor({sha, entries}: Tree = {sha: EMPTY_TREE_SHA, entries: []}) {
    super(sha)
    for (const entry of entries) {
      this.nodes.set(
        entry.name,
        entry.entries ? new WriteableTree(entry as EntryNode) : new Leaf(entry)
      )
    }
  }

  add(path: string, input: {clone(): WriteableTree | Leaf} | string): void {
    this.sha = undefined
    const [name, rest] = splitPath(path)
    if (rest) {
      const target = this.#makeNode(name)
      target.add(rest, input)
    } else {
      const node =
        typeof input === 'string'
          ? new Leaf({
              sha: input,
              mode: '100644'
            })
          : input.clone()
      this.nodes.set(name, node)
    }
  }

  #makeNode(segment: string): WriteableTree {
    this.sha = undefined
    if (!this.nodes.has(segment)) this.nodes.set(segment, new WriteableTree())
    return this.getNode(segment)
  }

  #getNode(segment: string) {
    return this.nodes.get(segment) as WriteableTree | undefined
  }

  remove(path: string): number {
    this.sha = undefined
    const [name, rest] = splitPath(path)
    if (rest) {
      const target = this.#getNode(name)
      if (!target) return 0
      const newSize = target.remove(rest)
      if (newSize === 0) this.nodes.delete(name)
      return this.nodes.size
    }
    this.nodes.delete(name)
    return this.nodes.size
  }

  rename(from: string, to: string): void {
    const entry = this.get(from)
    if (!entry) return
    this.remove(from)
    this.add(to, entry.clone())
  }

  applyChanges(changes: Array<Change>): void {
    for (const change of changes) {
      switch (change.op) {
        case 'delete': {
          const existing = this.get(change.path)
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
          assert(
            !existing || existing instanceof Leaf,
            `Cannot delete: ${change.path}`
          )
          if (existing && existing.sha === change.sha) continue
          this.add(change.path, change.sha)
          continue
        }
      }
    }
  }

  async #getTree(): Promise<Tree> {
    const entries = await this.#treeEntries()
    if (this.sha) return {sha: this.sha, entries}
    const serialized = serializeTreeEntries(entries)
    this.sha = await hashTree(serialized)
    return {sha: this.sha, entries}
  }

  async #treeEntries(): Promise<Array<Entry>> {
    const entries = Array<Entry>()
    for (const [name, node] of this.nodes.entries()) {
      if (node instanceof TreeBase) {
        const entry = await node.#getTree()
        entries.push({name, ...node, ...entry})
      } else {
        entries.push({name, ...node})
      }
    }
    return entries
  }

  async getSha(): Promise<string> {
    return (await this.#getTree()).sha
  }

  async compile(): Promise<ReadonlyTree> {
    return new ReadonlyTree(await this.#getTree())
  }

  clone(): WriteableTree {
    const result = new WriteableTree()
    for (const [name, entry] of this.nodes) result.add(name, entry.clone())
    result.sha = this.sha
    return result
  }
}
