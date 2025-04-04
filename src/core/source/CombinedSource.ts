import {entries, keys} from '../util/Objects.js'
import type {Change} from './Change.js'
import type {Source} from './Source.js'
import {type ReadonlyTree, WriteableTree} from './Tree.js'
import {assert, splitPath} from './Utils.js'

export class CombinedSource implements Source {
  #only: Source | undefined
  #builder = new WriteableTree()
  #shas = new Map<string, string>()
  #sources: Record<string, Source>

  constructor(sources: Record<string, Source>) {
    this.#sources = sources
    const [first] = keys(sources)
    if (keys(sources).length === 1) this.#only = sources[first]
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

  async getBlobs(
    shas: Array<string>
  ): Promise<Array<[sha: string, blob: Uint8Array]>> {
    if (this.#only) return this.#only.getBlobs(shas)
    const tree = await this.getTree()
    const perSource = new Map<Source, Array<string>>()
    for (const [name, source] of entries(this.#sources)) {
      const sub = tree.getNode(name)
      for (const sha of shas) {
        if (!sub.hasSha(sha)) continue
        const sourceShas = perSource.get(source) ?? []
        sourceShas.push(sha)
        perSource.set(source, sourceShas)
      }
    }
    return Promise.all(
      Array.from(perSource.entries()).flatMap(async ([source, shas]) => {
        return source.getBlobs(shas)
      })
    ).then(res => res.flat())
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
