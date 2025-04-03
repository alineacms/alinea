import {entries} from '../util/Objects.js'
import type {Change} from './Change.js'
import type {Source} from './Source.js'
import {type ReadonlyTree, WriteableTree} from './Tree.js'
import {assert, splitPath} from './Utils.js'

export class CombinedSource implements Source {
  #builder = new WriteableTree()
  #shas = new Map<string, string>()
  #sources: Record<string, Source>

  constructor(sources: Record<string, Source>) {
    this.#sources = sources
  }

  async getTree() {
    await Promise.all(
      entries(this.#sources).map(async ([name, source]) => {
        const tree = await source.getTree()
        const previous = this.#shas.get(name)
        if (previous === tree.sha) return
        this.#shas.set(name, tree.sha)
        this.#builder.add(name, tree)
      })
    )
    return this.#builder.compile()
  }

  async getTreeIfDifferent(sha: string): Promise<ReadonlyTree | undefined> {
    const tree = await this.getTree()
    if (tree.sha === sha) return undefined
    return tree
  }

  async getBlob(sha: string): Promise<Uint8Array> {
    const tree = await this.getTree()
    for (const [name, source] of entries(this.#sources)) {
      const sub = tree.getNode(name)
      if (sub.hasSha(sha)) return source.getBlob(sha)
    }
    throw new Error(`Blob ${sha} not found in any source`)
  }

  async applyChanges(changes: Array<Change>) {
    const perSource = new Map<string, Array<Change>>()
    for (const change of changes) {
      const [name, rest] = splitPath(change.path)
      assert(rest, `Invalid path: ${change.path}`)
      const sourceChanges = perSource.get(name) ?? []
      sourceChanges.push({...change, path: rest})
      perSource.set(name, sourceChanges)
    }
    for (const [name, changes] of perSource) {
      const source = this.#sources[name]
      if (!source) throw new Error(`Source ${name} not found`)
      await source.applyChanges(changes)
    }
  }
}
