import type {Config} from '#/core/Config.js'
import {createRequire} from 'node:module'
import {EntryDatabase} from '#/database/EntryDatabase.js'
import {EntryStore} from '#/database/EntryStore.js'
import {runtimeDatabase} from '#/database/driver/RuntimeDatabase.js'

/** Open the generated database and add one writable, connection-local layer. */
export async function generatedDatabase(config: Config): Promise<EntryStore> {
  const require = createRequire(import.meta.url)
  const path = require.resolve('@alinea/generated/database.sqlite')
  const db = await runtimeDatabase({path, readonly: true})
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
