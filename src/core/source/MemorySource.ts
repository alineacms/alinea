import type {Change} from './Change.js'
import {hashBlob} from './GitUtils.js'
import type {Source} from './Source.js'
import {ReadonlyTree} from './Tree.js'
import {assert} from './Utils.js'

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

  async getBlob(sha: string) {
    const blob = this.#blobs.get(sha)
    assert(blob, `Blob not found: ${sha}`)
    return blob
  }

  async addBlob(contents: Uint8Array) {
    const sha = await hashBlob(contents)
    this.#blobs.set(sha, contents)
    return sha
  }

  async applyChanges(changes: Array<Change>) {
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
    const tree = this.#tree.clone()
    tree.applyChanges(changes)
    this.#tree = await tree.compile()
  }
}
