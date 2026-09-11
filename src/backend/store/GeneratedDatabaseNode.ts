import type {Config} from '#/core/Config.js'
import {runtimeDatabase} from '#/database/driver/RuntimeDatabase.js'
import {findPackageJSON} from 'node:module'
import {dirname, join} from 'node:path'
import {createGeneratedDatabase} from './GeneratedDatabase.js'

function generatedDatabasePath(): string {
  const packageFile = findPackageJSON('@alinea/generated', import.meta.url)
  if (!packageFile) throw new Error('Could not find @alinea/generated')
  return join(dirname(packageFile), 'database.sqlite')
}

/** Open the NFT-traced generated file through the native SQLite driver. */
export async function generatedDatabase(config: Config) {
  const path = generatedDatabasePath()
  const db = await runtimeDatabase({path, readonly: true})
  return createGeneratedDatabase(config, db)
}
