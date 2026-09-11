import type {Config} from '#/core/Config.js'
import {EntryDatabase} from '#/database/EntryDatabase.js'
import {EntryStore} from '#/database/EntryStore.js'
import type {Database} from 'rado'

/** Add one writable, connection-local layer over a generated database. */
export async function createGeneratedDatabase(
  config: Config,
  db: Database
): Promise<EntryStore> {
  const base = new EntryDatabase(config, db, {searchReady: true})
  try {
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
