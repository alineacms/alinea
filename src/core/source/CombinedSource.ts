import {assert} from '../util/Assert.js'
import {entries, keys} from '../util/Objects.js'
import type {Change, ChangesBatch} from './Change.js'
import type {Source} from './Source.js'
import {ReadonlyTree, WriteableTree} from './Tree.js'
import {splitPath} from './Utils.js'

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

  async *getBlobs(
    shas: Array<string>
  ): AsyncGenerator<[sha: string, blob: Uint8Array]> {
    if (this.#only) return this.#only.getBlobs(shas)
    const tree = await this.getTree()
    const perSource = new Map<Source, Array<string>>()
    for (const [name, source] of entries(this.#sources)) {
      const sub = tree.get(name)
      if (!(sub instanceof ReadonlyTree)) continue
      for (const sha of shas) {
        if (!sub.hasSha(sha)) continue
        const sourceShas = perSource.get(source) ?? []
        sourceShas.push(sha)
        perSource.set(source, sourceShas)
      }
    }
    for (const [source, shas] of perSource) {
      yield* source.getBlobs(shas)
    }
  }

  async applyChanges(batch: ChangesBatch) {
    const perSource = new Map<string, Array<Change>>()
    for (const change of batch.changes) {
      const [name, rest] = splitPath(change.path)
      assert(rest, `Invalid path: ${change.path}`)
      const sourceChanges = perSource.get(name) ?? []
      sourceChanges.push({...change, path: rest})
      perSource.set(name, sourceChanges)
    }
    for (const [name, changes] of perSource) {
      const source = this.#sources[name]
      if (!source) throw new Error(`Source ${name} not found`)
      const fromSha = this.#shas.get(name)
      assert(fromSha)
      await source.applyChanges({
        fromSha,
        changes
      })
    }
  }
}
