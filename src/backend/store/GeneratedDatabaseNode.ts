import type {Config} from '#/core/Config.js'
import {runtimeDatabase} from '#/database/driver/RuntimeDatabase.js'
import {existsSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {createGeneratedDatabase} from './GeneratedDatabase.js'

function generatedDatabasePath(): string {
  let directory = process.cwd()
  while (true) {
    const candidate = join(
      directory,
      'node_modules',
      '@alinea',
      'generated',
      'database.sqlite'
    )
    if (existsSync(candidate)) return candidate
    const parent = dirname(directory)
    if (parent === directory)
      throw new Error('Could not find @alinea/generated/database.sqlite')
    directory = parent
  }
}

/** Open the NFT-traced generated file through the native SQLite driver. */
export async function generatedDatabase(config: Config) {
  const db = await runtimeDatabase({
    path: generatedDatabasePath(),
    readonly: true
  })
  return createGeneratedDatabase(config, db)
}
