import {assert} from '../util/Assert.js'
import type {ChangesBatch} from './Change.js'
import {hashBlob} from './GitUtils.js'
import {ShaMismatchError} from './ShaMismatchError.js'
import type {Source} from './Source.js'
import {ReadonlyTree} from './Tree.js'

type BlobContents = Uint8Array | string

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export class MemorySource implements Source {
  #tree: ReadonlyTree
  #blobs = new Map<string, BlobContents>()

  constructor(
    tree = ReadonlyTree.EMPTY,
    blobs: Map<string, Uint8Array> = new Map()
  ) {
    this.#tree = tree
    this.#blobs = blobs
  }

  static fromTexts(tree: ReadonlyTree, blobs: Map<string, string>) {
    const source = new MemorySource(tree)
    source.#blobs = blobs
    return source
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
      yield [sha, typeof blob === 'string' ? encoder.encode(blob) : blob]
    }
  }

  async *getBlobTexts(
    shas: Array<string>
  ): AsyncGenerator<[sha: string, text: string]> {
    for (const sha of shas) {
      const blob = this.#blobs.get(sha)
      assert(blob, `Blob not found: ${sha}`)
      yield [sha, typeof blob === 'string' ? blob : decoder.decode(blob)]
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
    for (const sha of this.#blobs.keys()) {
      if (!compiled.hasSha(sha)) this.#blobs.delete(sha)
    }
    this.#tree = compiled
  }
}
