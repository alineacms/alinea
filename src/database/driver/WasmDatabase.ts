import type {Database as WasmSqlite} from '@alinea/sqlite-wasm/Database.js'
import type {DatabaseOptions} from 'rado'
import {connect} from 'rado/driver/sql.js'
import type {DatabaseHandle} from './DatabaseHandle.js'

export interface WasmDatabaseHandle extends DatabaseHandle {
  database: ReturnType<typeof connect>
  fork(): Promise<WasmDatabaseHandle>
  export(): Uint8Array
}

/**
 * Page cache in KiB. SQLite's default of 2 MB holds only 32 of the 64 KB
 * pages a browser store uses: a large sync then copies pages in and out of
 * the database memory over and over, which halves its speed.
 */
const cacheSize = -16384

/** The WASM SQLite database class, loaded on first use. */
export async function wasmSqlite(): Promise<new () => WasmSqlite> {
  const {default: init} = await import('@alinea/sqlite-wasm')
  const {Database} = await init()
  return Database
}

/** Connect to `sqlite`; forks keep its page cache size. */
export function wasmHandle(
  sqlite: WasmSqlite,
  options?: DatabaseOptions
): WasmDatabaseHandle {
  return {
    database: connect(sqlite, options),
    driver: 'wasm',
    fork: async () => wasmHandle(sqlite.fork(), options),
    export: () => sqlite.export()
  }
}

/** Open an in-memory WASM connection, optionally from a complete SQLite file. */
export async function openWasmDatabase(
  data?: Uint8Array,
  options?: DatabaseOptions
): Promise<WasmDatabaseHandle> {
  const {default: init} = await import('@alinea/sqlite-wasm')
  const {Database} = await init()
  const sqlite = new Database(data)
  sqlite.run(`pragma cache_size = ${cacheSize}`)
  return wasmHandle(sqlite, options)
}

export async function wasmDatabase(data?: Uint8Array) {
  return (await openWasmDatabase(data)).database
}
