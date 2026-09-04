import {assert} from '../util/Assert.js'
import type {ChangesBatch} from './Change.js'
import {ShaMismatchError} from './ShaMismatchError.js'
import type {GetBlobsOptions, Source} from './Source.js'
import type {ReadonlyTree} from './Tree.js'

export class OverlaySource implements Source {
  #source: Source
  #tree: ReadonlyTree
  #blobs = new Map<string, Uint8Array>()

  constructor(source: Source, tree: ReadonlyTree) {
    this.#source = source
    this.#tree = tree
  }

  static async create(source: Source): Promise<OverlaySource> {
    return new OverlaySource(source, await source.getTree())
  }

  async getTree(): Promise<ReadonlyTree> {
    return this.#tree
  }

  async getTreeIfDifferent(sha: string): Promise<ReadonlyTree | undefined> {
    return this.#tree.sha === sha ? undefined : this.#tree
  }

  async *getBlobs(
    shas: ReadonlyArray<string>,
    options: GetBlobsOptions = {}
  ): AsyncGenerator<[sha: string, blob: Uint8Array]> {
    const fromSource: Array<string> = []
    for (const sha of shas) {
      if (options.signal?.aborted)
        throw options.signal.reason ?? new Error('Blob transfer aborted')
      const blob = this.#blobs.get(sha)
      if (blob) yield [sha, blob]
      else fromSource.push(sha)
    }
    yield* this.#source.getBlobs(fromSource, options)
  }

  async applyChanges(batch: ChangesBatch): Promise<void> {
    if (this.#tree.sha !== batch.fromSha)
      throw new ShaMismatchError(batch.fromSha, this.#tree.sha)
    for (const change of batch.changes) {
      if (change.op === 'delete') continue
      assert(change.contents, 'Missing contents')
      this.#blobs.set(change.sha, change.contents)
    }
    this.#tree = await this.#tree.withChanges(batch)
    for (const sha of this.#blobs.keys()) {
      if (!this.#tree.hasSha(sha)) this.#blobs.delete(sha)
    }
  }
}
