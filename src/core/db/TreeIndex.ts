import type {Config} from '../Config.js'
import type {Entry, EntryStatus} from '../Entry.js'
import type {Source} from '../source/Source.js'
import {ReadonlyTree} from '../source/Tree.js'
import {compareStrings} from '../source/Utils.js'
import {entryInfo} from '../util/EntryFilenames.js'
import {entries} from '../util/Objects.js'

export async function buildIndex(config: Config, source: Source) {
  const tree = await source.getTree()
  return buildNode(config, tree)
}

function buildNode(config: Config, tree: ReadonlyTree) {
  const node = new Node()
  node.children = new Level(tree)
  return new Index(config, node)
}

class Index {
  #config: Config
  entries = new Map<string, Node>()

  constructor(config: Config, root: Node) {
    this.#config = config
    for (const [key, workspace] of entries(config.workspaces)) {
      const outer = root.children.get(key)
      for (const [key, root] of entries(workspace)) {
        const inner = outer.children.get(key)
        this.entries.set(key, entry)
      }
    }
  }

  parseEntry(sha: string) {
    return {sha}
  }
}

class Node {
  versions = new Map<EntryStatus, string>()
  children = Level.EMPTY

  sha() {
    const shas = Array.from(this.versions.values())
    if (this.children) {
      shas.push(this.children.sha)
    }
    return shas.sort(compareStrings).join('')
  }

  index(into: Index, path: string = '') {
    let previous: Entry
    for (const [status, sha] of this.versions) {
      const entry = into.parseEntry(sha)
    }
    this.children?.index(into, path)
  }
}

class Level {
  static EMPTY = new Level(ReadonlyTree.EMPTY)
  #tree: ReadonlyTree
  #nodes = new Map<string, Node>()

  constructor(tree: ReadonlyTree) {
    this.#tree = tree
    for (const [key, entry] of tree.nodes) {
      if (entry.type === 'blob') {
        const fileName = key.slice(0, -'.json'.length)
        const [name, status] = entryInfo(fileName)
        const node = this.get(name)
        node.versions.set(status, entry.sha)
      } else {
        const node = this.get(key)
        node.children = new Level(entry)
      }
    }
  }

  get(name: string): Node {
    if (this.#nodes.has(name)) return this.#nodes.get(name)!
    const node = new Node()
    this.#nodes.set(name, node)
    return node
  }

  get sha() {
    return this.#tree.sha
  }

  index(into: Index, path: string) {
    for (const [name, node] of this.#nodes) node.index(into, `${path}${name}/`)
  }
}
