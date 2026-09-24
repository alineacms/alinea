import type {Config} from '#/core/Config.js'
import {runtimeDatabase} from '#/database/driver/RuntimeDatabase.js'
import {fileURLToPath} from 'node:url'
import type {DatabaseOptions} from 'rado'
import {createGeneratedDatabase} from './GeneratedDatabase.js'

async function generatedDatabasePath(): Promise<string> {
  // @ts-ignore - generated at build time by the Alinea CLI
  const {database} = await import('@alinea/generated/database.node.js')
  if (!(database instanceof URL))
    throw new Error('The generated database location is missing')
  return fileURLToPath(database)
}

/**
 * One store per config: the CMS and a handler created from it share one
 * overlay, one sync and one preview cache. Queries compile against the
 * config's own types, so a copy of the config loaded by another bundle
 * gets its own store.
 */
const stores = new WeakMap<Config, ReturnType<typeof createGeneratedDatabase>>()
/** The shared connection reports statements to the last registered logger. */
const loggers = new WeakMap<Config, DatabaseOptions['logQuery']>()

/** Open the traced generated file through the native SQLite driver. */
export function generatedDatabase(
  config: Config,
  options: DatabaseOptions = {}
) {
  if (options.logQuery) loggers.set(config, options.logQuery)
  let store = stores.get(config)
  if (!store) {
    store = generatedDatabasePath()
      .then(path =>
        runtimeDatabase({
          path,
          readonly: true,
          logQuery: (query, durationMs) =>
            loggers.get(config)?.(query, durationMs)
        })
      )
      .then(db => createGeneratedDatabase(config, db))
    stores.set(config, store)
    store.catch(() => {
      if (stores.get(config) === store) stores.delete(config)
    })
  }
  return store
}
