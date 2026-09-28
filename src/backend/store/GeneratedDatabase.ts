import type {Config} from '#/core/Config.js'
import type {ReadonlyTree} from '#/core/source/Tree.js'
import {DatabaseSource} from '#/database/DatabaseSource.js'
import type {DatabaseHandle} from '#/database/driver/DatabaseHandle.js'
import {assertReadableData} from '#/database/entry/EntryData.js'
import {EntryDatabase} from '#/database/EntryDatabase.js'
import {EntryStore} from '#/database/EntryStore.js'

/**
 * Serve a generated database from a connection that keeps its writes in
 * memory, so syncs and commits never reach the generated file.
 */
export async function createGeneratedDatabase(
  config: Config,
  {database: db, fork, driver}: DatabaseHandle
): Promise<EntryStore> {
  let initialTree: ReadonlyTree | undefined
  const database = new EntryDatabase(config, db, {
    fork,
    includedAtBuild(filePath) {
      return initialTree?.has(filePath) ?? false
    },
    // Nothing reopens the in-memory writes: skip storing the synced tree.
    recordsTree: false
  })
  try {
    await assertReadableData(db)
    initialTree = await database.getTree()
    return new EntryStore(config, database, new DatabaseSource(database), {
      ownsDatabase: true,
      sourceFollowsDatabase: true,
      driver
    })
  } catch (error) {
    await database.close()
    throw error
  }
}
