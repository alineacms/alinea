import type {Config} from '#/core/Config.js'
import {OverlaySource} from '#/core/source/OverlaySource.js'
import {createRequire} from 'node:module'
import {DatabaseSource} from '#/database/DatabaseSource.js'
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
    const source = await OverlaySource.create(new DatabaseSource(base))
    const overlay = await base.overlay(source)
    return new EntryStore(config, overlay, source, {
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
