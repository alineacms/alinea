import type {ChangesBatch} from '../source/Change.js'
import type {ReadonlyTree} from '../source/Tree.js'

export interface EntryEngineSource {
  getTree(): Promise<ReadonlyTree>
  getTreeIfDifferent(sha: string): Promise<ReadonlyTree | undefined>
  getBlobs(shas: Array<string>): AsyncGenerator<[sha: string, blob: Uint8Array]>
  applyChanges?(batch: ChangesBatch): Promise<void>
}
