import type {Config} from '#/core/Config.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {createEntrySource} from '#test/EntryFixture.js'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import {EntryDatabase} from '#/database/EntryDatabase.js'
import {EntryStore} from '#/database/EntryStore.js'

/** Native-driver store synced from fixture entries. Fast enough for fuzz loops. */
export async function createPropertyStore(
  config: Config,
  entries: Array<{
    id: string
    type: string
    index: string
    data?: Record<string, unknown>
    title?: string
    path?: string
    status?: 'draft' | 'archived' | 'published'
    parentPaths?: Array<string>
  }>
): Promise<{store: EntryStore; close: () => Promise<void>}> {
  const remote = await createEntrySource(config, entries)
  const sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryDatabase.createSchema(db, ReadonlyTree.EMPTY.sha)
  const store = new EntryStore(
    config,
    new EntryDatabase(config, db),
    new MemorySource(),
    {ownsDatabase: true}
  )
  await store.syncWith(remote)
  return {
    store,
    close: async () => {
      await store.close()
      sqlite.close()
    }
  }
}
