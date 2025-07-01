import type {Config} from '../Config.js'
import type {Entry, EntryStatus} from '../Entry.js'
import type {Source} from '../source/Source.js'
import type {ReadonlyTree} from '../source/Tree.js'
import {entryInfo} from '../util/EntryFilenames.js'

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
    root.index(this)
  }

  parseEntry(sha: string) {
    return {sha}
  }
}

class Node {
  #sha: string | undefined
  versions = new Map<EntryStatus, string>()
  children?: Level

  get sha() {
    if (this.#sha) return this.#sha
    const all = []
    for (const [status, sha] of this.versions) {
      if (sha) all.push(`${status}:${sha}`)
    }
    if (this.children) {
      const childSha = this.children.sha
      if (childSha) all.push(`tree:${childSha}`)
    }
    this.#sha = all.join(',')
    return this.#sha
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
  #tree: ReadonlyTree
  #nodes = new Map<string, Node>()

  constructor(tree: ReadonlyTree) {
    this.#tree = tree
    for (const [key, entry] of tree.nodes) {
      if (entry.type === 'blob') {
        const fileName = key.slice(0, -'.json'.length)
        const [name, status] = entryInfo(fileName)
        const node = this.#get(name)
        node.versions.set(status, entry.sha)
      } else {
        const node = this.#get(key)
        node.children = new Level(entry)
      }
    }
  }

  #get(name: string): Node {
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
