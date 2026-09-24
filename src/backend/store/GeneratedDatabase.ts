import type {Config} from '#/core/Config.js'
import {assertReadableData} from '#/database/entry/EntryData.js'
import {EntryDatabase} from '#/database/EntryDatabase.js'
import {EntryStore} from '#/database/EntryStore.js'
import type {ReadonlyTree} from '#/core/source/Tree.js'
import type {Database} from 'rado'

/** Add one writable, connection-local layer over a generated database. */
export async function createGeneratedDatabase(
  config: Config,
  db: Database
): Promise<EntryStore> {
  let initialTree: ReadonlyTree | undefined
  const base = new EntryDatabase(config, db, {
    includedAtBuild(filePath) {
      return initialTree?.has(filePath) ?? false
    }
  })
  try {
    await assertReadableData(db)
    initialTree = await base.getTree()
    const overlay = await base.createOverlay()
    return new EntryStore(config, overlay.database, overlay.source, {
      close: async () => {
        await overlay.close()
        await base.close()
      }
    })
  } catch (error) {
    await base.close()
    throw error
  }
}
