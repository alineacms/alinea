import type {Config} from '#/core/Config.js'
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
    // searchReady: false so overlay gets searchDirty=true and creates
    // its temp FTS table (alinea_overlay_N_search). The generated DB's
    // base FTS is already built by compact() during generation.
    searchReady: false,
    includedAtBuild(filePath) {
      return initialTree?.has(filePath) ?? false
    }
  })
  try {
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
