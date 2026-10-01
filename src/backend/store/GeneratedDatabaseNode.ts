import type {Config} from '#/core/Config.js'
import {runtimeDatabase} from '#/database/driver/RuntimeDatabase.js'
import {fileURLToPath} from 'node:url'
import type {DatabaseOptions} from 'rado'
import {createGeneratedDatabase} from './GeneratedDatabase.js'

async function generatedDatabasePath(): Promise<string> {
  // The Alinea CLI names the database of the project it serves, since several
  // projects can share one generated package. Deployed builds have no such
  // variable and use the location the build recorded.
  const current = process.env.ALINEA_GENERATED_DATABASE
  if (current) return current
  // @ts-ignore - generated at build time by the Alinea CLI
  const {database} = await import('@alinea/generated/database.node.js')
  if (!(database instanceof URL))
    throw new Error('The generated database location is missing')
  return fileURLToPath(database)
}

/**
 * Open the traced generated file as an in-memory overlay. Every caller gets
 * its own overlay: the CMS syncs its store through the handler, which syncs
 * its own, so they must not share one or the CMS would wait for itself.
 */
export async function generatedDatabase(
  config: Config,
  options: DatabaseOptions = {}
) {
  const db = await runtimeDatabase({
    path: await generatedDatabasePath(),
    overlay: true,
    logQuery: options.logQuery
  })
  return createGeneratedDatabase(config, db)
}
