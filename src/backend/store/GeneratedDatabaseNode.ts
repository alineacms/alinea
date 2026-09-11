import type {Config} from '#/core/Config.js'
import {runtimeDatabase} from '#/database/driver/RuntimeDatabase.js'
import {createRequire} from 'node:module'
import {dirname, join} from 'node:path'
import {createGeneratedDatabase} from './GeneratedDatabase.js'

function generatedDatabasePath(): string {
  const packageFile = createRequire(import.meta.url).resolve(
    '@alinea/generated/package.json'
  )
  return join(dirname(packageFile), 'database.sqlite')
}

/** Open the NFT-traced generated file through the native SQLite driver. */
export async function generatedDatabase(config: Config) {
  const db = await runtimeDatabase({
    path: generatedDatabasePath(),
    readonly: true
  })
  return createGeneratedDatabase(config, db)
}
