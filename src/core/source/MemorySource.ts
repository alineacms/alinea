import {assert} from '../util/Assert.js'
import type {ChangesBatch} from './Change.js'
import {hashBlob} from './GitUtils.js'
import {ShaMismatchError} from './ShaMismatchError.js'
import type {GetBlobsOptions, Source} from './Source.js'
import {Leaf, ReadonlyTree} from './Tree.js'

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
    shas: ReadonlyArray<string>,
    options: GetBlobsOptions = {}
  ): AsyncGenerator<[sha: string, blob: Uint8Array]> {
    for (const sha of shas) {
      if (options.signal?.aborted)
        throw options.signal.reason ?? new Error('Blob transfer aborted')
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
      }
    }
    const compiled = await this.#tree.withChanges(batch)
    // Only blobs at changed paths can have become orphaned.
    for (const change of batch.changes) {
      const previous = this.#tree.get(change.path)
      if (previous instanceof Leaf && !compiled.hasSha(previous.sha))
        this.#blobs.delete(previous.sha)
    }
    this.#tree = compiled
  }
}
