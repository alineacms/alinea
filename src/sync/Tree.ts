import type {Change} from './Change.js'
import {hashTree, serializeTreeEntries} from './GitUtils.js'
import {assert, compareStrings} from './Utils.js'

export interface FlatTreeEntry {
  path: string
  mode: string
  type: string
  sha: string
}

export interface FlatTree {
  sha: string
  tree: Array<FlatTreeEntry>
}

export interface Tree {
  sha: string
  entries: Array<Entry>
}

export interface Entry {
  name: string
  sha: string
  mode: string
  entries?: Array<Entry>
}

interface EntryNode extends Entry {
  entries: Array<Entry>
}

export class Leaf {
  readonly name: string
  readonly sha: string
  readonly mode: string

  constructor({name, sha, mode}: Entry) {
    this.name = name
    this.sha = sha
    this.mode = mode
  }

  clone(rename?: string): Leaf {
    if (rename) return new Leaf({...this, name: rename})
    return this
  }

  toJSON(): Entry {
    return {...this}
  }
}

const EMPTY_TREE_SHA = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

class TreeBase<Node extends TreeBase<Node>> {
  sha: string | undefined
  readonly mode: string = '040000'
  protected nodes = new Map<string, Node | Leaf>()

  constructor({sha, entries}: Tree, makeNode: (entry: EntryNode) => Node) {
    this.sha = sha
    for (const entry of entries) {
      this.nodes.set(
        entry.name,
        entry.entries ? makeNode(entry as EntryNode) : new Leaf(entry)
      )
    }
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

  index(): Map<string, string> {
    return new Map(this.#fileEntries(''))
  }

  #fileEntries(prefix: string) {
    return Array.from(this.nodes, ([key, entry]): Array<[string, string]> => {
      if (entry instanceof TreeBase)
        return entry.#fileEntries(`${prefix}${key}/`)
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

export class ReadonlyTree extends TreeBase<ReadonlyNode> {
  sha: string
  static EMPTY = new ReadonlyTree({sha: EMPTY_TREE_SHA, entries: []})

  constructor(source: Tree) {
    super(source, entry => new ReadonlyNode(entry))
    this.sha = source.sha
  }

  get entries(): Array<Entry> {
    return [...this.nodes.values()].map(entry => entry.toJSON())
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

  toJSON(): Tree {
    return {sha: this.sha, entries: this.entries}
  }

  flat() {
    return {
      sha: this.sha,
      tree: this.#flatEntries('')
    }
  }

  #flatEntries(prefix: string) {
    return Array.from(this.nodes, ([key, entry]): Array<FlatTreeEntry> => {
      const self = {
        type: entry instanceof ReadonlyNode ? 'tree' : 'blob',
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

export class ReadonlyNode extends ReadonlyTree {
  readonly name: string
  readonly mode = '040000'

  constructor({name, sha, entries}: Entry) {
    assert(entries)
    super({sha, entries})
    this.name = name
  }

  clone(rename?: string): WriteableNode {
    return new WriteableNode(rename ?? this.name, this)
  }

  toJSON() {
    return {
      name: this.name,
      sha: this.sha,
      mode: this.mode,
      entries: this.entries
    }
  }
}

export class WriteableTree extends TreeBase<WriteableNode> {
  readonly mode = '040000'

  constructor({sha, entries}: Tree = {sha: EMPTY_TREE_SHA, entries: []}) {
    super({sha, entries}, entry => new WriteableNode(entry.name, entry))
  }

  add(path: string, input: WriteableNode | Leaf | string): void {
    this.sha = undefined
    const [name, rest] = splitPath(path)
    if (rest) {
      const target = this.#makeNode(name)
      target.add(rest, input)
    } else {
      const node =
        typeof input === 'string'
          ? new Leaf({
              name: path,
              sha: input,
              mode: '100644'
            })
          : input
      this.nodes.set(name, node)
    }
  }

  #makeNode(segment: string): WriteableNode {
    this.sha = undefined
    if (!this.nodes.has(segment))
      this.nodes.set(segment, new WriteableNode(segment))
    return this.getNode(segment)
  }

  #getNode(segment: string) {
    return this.nodes.get(segment) as WriteableNode | undefined
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
    const name = to.slice(to.lastIndexOf('/') + 1)
    this.add(to, entry.clone(name))
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
    for (const node of this.nodes.values()) {
      if (node instanceof WriteableNode) {
        const entry = await node.#getTree()
        entries.push({...node, ...entry})
      } else {
        entries.push(node)
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

export class WriteableNode extends WriteableTree {
  readonly mode = '040000'

  constructor(
    public name: string,
    source?: Tree
  ) {
    super(source)
    this.name = name
  }

  clone(rename?: string): WriteableNode {
    const result = new WriteableNode(rename ?? this.name)
    for (const [name, entry] of this.nodes) result.add(name, entry.clone())
    result.sha = this.sha
    return result
  }
}

function splitPath(path: string): [name: string, rest: string | undefined] {
  const firstSlash = path.indexOf('/')
  if (firstSlash === -1) return [path, undefined]
  const name = path.slice(0, firstSlash)
  const rest = path.slice(firstSlash + 1)
  return [name, rest]
}
