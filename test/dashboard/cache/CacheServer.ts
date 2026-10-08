import type {Mutation} from '#/core/db/Mutation.js'
import type {Tree} from '#/core/source/Tree.js'
import {LocalDB} from '#/database/LocalDB.js'
import {createEntrySource} from '#test/EntryFixture.js'
import {cacheConfig, cacheEntries} from './CacheConfig.js'

/** The backend every build syncs from, as the server of a deployment. */
export class CacheServer {
  #db: LocalDB

  static async create(): Promise<CacheServer> {
    const config = cacheConfig('a')
    return new CacheServer(
      new LocalDB(config, await createEntrySource(config, cacheEntries()))
    )
  }

  private constructor(db: LocalDB) {
    this.#db = db
  }

  async tree(sha: string): Promise<Tree | undefined> {
    return (await this.#db.getTreeIfDifferent(sha))?.toJSON()
  }

  async blobs(shas: Array<string>): Promise<Array<[string, Uint8Array]>> {
    return Array.fromAsync(this.#db.getBlobs(shas))
  }

  mutate(mutations: Array<Mutation>): Promise<{sha: string}> {
    return this.#db.mutate(mutations)
  }
}
