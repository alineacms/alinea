import type {ChangesBatch} from '#/core/source/Change.js'
import type {GetBlobsOptions, Source} from '#/core/source/Source.js'
import type {ReadonlyTree} from '#/core/source/Tree.js'
import type {EntryDatabase} from './EntryDatabase.js'

/** Read-only Source view backed by exact payload text in an entry database. */
export class DatabaseSource implements Source {
  #database: EntryDatabase

  constructor(database: EntryDatabase) {
    this.#database = database
  }

  getTree(): Promise<ReadonlyTree> {
    return this.#database.getTree()
  }

  async getTreeIfDifferent(sha: string): Promise<ReadonlyTree | undefined> {
    const tree = await this.getTree()
    return tree.sha === sha ? undefined : tree
  }

  getBlobs(shas: ReadonlyArray<string>, options?: GetBlobsOptions) {
    return this.#database.getBlobs(shas, options)
  }

  applyChanges(_batch: ChangesBatch): Promise<void> {
    return Promise.reject(new Error('Cannot write to a database source'))
  }
}
