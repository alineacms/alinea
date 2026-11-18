import {MemoryObjectStore, type ObjectStore} from '@alinea/graft'
import {writeContentPack} from '#/backend/api/ContentPack.js'
import type {SyncApi} from '#/core/Connection.js'
import type {
  ContentPack,
  GetBlobsOptions,
  Source
} from '#/core/source/Source.js'
import type {ReadonlyTree} from '#/core/source/Tree.js'
import {treeObjects} from '#/core/source/TreeObjects.js'

/**
 * Packs of the content on disk for the dev dashboard, so it syncs with one
 * request as against a graft store. Every content tree served is kept as
 * git trees in memory, so a later pack holds only what changed since; blobs
 * are read from disk and kept, so an edited file is sent as a delta of the
 * version the dashboard has.
 */
export class DevPacks implements SyncApi {
  #source: Source
  #kept = new MemoryObjectStore()
  #objects: ObjectStore
  #tree: ReadonlyTree | undefined

  constructor(source: Source) {
    this.#source = source
    const kept = this.#kept
    const current = () => this.#tree
    this.#objects = {
      has: shas => kept.has(shas),
      put: objects => kept.put(objects),
      async get(shas) {
        const found = await kept.get(shas)
        // Files on disk hold the current tree's blobs only; an older
        // version is no base unless it was read before
        const missing = shas.filter(
          sha => !found.has(sha) && current()?.hasSha(sha)
        )
        if (missing.length === 0) return found
        const read = Array<{sha: string; type: 'blob'; data: Uint8Array}>()
        for await (const [sha, data] of source.getBlobs(missing))
          read.push({sha, type: 'blob', data})
        await kept.put(read)
        for (const {sha, type, data} of read) found.set(sha, {type, data})
        return found
      }
    }
  }

  async getTreeIfDifferent(sha: string): Promise<ReadonlyTree | undefined> {
    const tree = await this.#source.getTree()
    await this.#keep(tree)
    return tree.sha === sha ? undefined : tree
  }

  getBlobs(shas: ReadonlyArray<string>, options?: GetBlobsOptions) {
    return this.#source.getBlobs(shas, options)
  }

  async getPack(have?: string): Promise<ContentPack | undefined> {
    const tree = await this.#source.getTree()
    const sha = tree.sha
    if (have === undefined) return {sha}
    if (have === sha) return undefined
    this.#tree = tree
    await this.#keep(tree)
    // A tree this server never served, as after a restart, is no base
    const held = have && (await this.#kept.has([have])).has(have)
    const pack = await writeContentPack(
      this.#objects,
      held ? have : undefined,
      sha
    )
    return {sha, pack}
  }

  async #keep(tree: ReadonlyTree): Promise<void> {
    if ((await this.#kept.has([tree.sha])).has(tree.sha)) return
    await this.#kept.put(treeObjects(tree))
  }
}
