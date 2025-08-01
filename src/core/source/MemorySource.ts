import {assert} from '../util/Assert.js'
import type {ChangesBatch} from './Change.js'
import {hashBlob} from './GitUtils.js'
import {ShaMismatchError} from './ShaMismatchError.js'
import type {Source} from './Source.js'
import {ReadonlyTree} from './Tree.js'

export class MemorySource implements Source {
  #tree: ReadonlyTree
  #blobs = new Map<string, Uint8Array>()

  constructor(
    tree = ReadonlyTree.EMPTY,
    blobs: Map<string, Uint8Array> = new Map()
  ) {
    this.#tree = tree
    this.#blobs = blobs
  }

  async getTree() {
    return this.#tree
  }

  async getTreeIfDifferent(sha: string): Promise<ReadonlyTree | undefined> {
    return this.#tree.sha === sha ? undefined : this.#tree
  }

  async *getBlobs(
    shas: Array<string>
  ): AsyncGenerator<[sha: string, blob: Uint8Array]> {
    for (const sha of shas) {
      const blob = this.#blobs.get(sha)
      assert(blob, `Blob not found: ${sha}`)
      yield [sha, blob]
    }
  }

  async addBlob(contents: Uint8Array) {
    const sha = await hashBlob(contents)
    this.#blobs.set(sha, contents)
    return sha
  }

  async applyChanges(batch: ChangesBatch) {
    const {fromSha, changes} = batch
    if (this.#tree.sha !== fromSha)
      throw new ShaMismatchError(fromSha, this.#tree.sha)
    for (const change of changes) {
      switch (change.op) {
        case 'add': {
          assert(change.contents, 'Missing contents')
          this.#blobs.set(change.sha, change.contents)
          continue
        }
        case 'delete': {
          this.#blobs.delete(change.sha)
          continue
        }
      }
    }
    this.#tree = await this.#tree.withChanges(batch)
  }
}
