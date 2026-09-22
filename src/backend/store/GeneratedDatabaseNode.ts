import type {Config} from '#/core/Config.js'
import {runtimeDatabase} from '#/database/driver/RuntimeDatabase.js'
import {fileURLToPath} from 'node:url'
import {createGeneratedDatabase} from './GeneratedDatabase.js'

async function generatedDatabasePath(): Promise<string> {
  // @ts-ignore - generated at build time by the Alinea CLI
  const {database} = await import('@alinea/generated/database.node.js')
  if (!(database instanceof URL))
    throw new Error('The generated database location is missing')
  return fileURLToPath(database)
}

/** Open the traced generated file through the native SQLite driver. */
export async function generatedDatabase(config: Config) {
  const path = await generatedDatabasePath()
  const db = await runtimeDatabase({path, readonly: true})
  return createGeneratedDatabase(config, db)
}
