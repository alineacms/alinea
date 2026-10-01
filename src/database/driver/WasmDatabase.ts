import type {
  Storage,
  Database as WasmSqlite
} from '@alinea/sqlite-wasm/Database.js'
import type {DatabaseOptions} from 'rado'
import {connect} from 'rado/driver/sql.js'
import type {DatabaseHandle} from './DatabaseHandle.js'

export interface WasmDatabaseHandle extends DatabaseHandle {
  database: ReturnType<typeof connect>
  fork(): Promise<WasmDatabaseHandle>
  export(): Uint8Array
  /** Resolves once every commit so far is stored; at once in memory. */
  flush(): Promise<void>
  /**
   * Store this database from now on, replacing what the storage held, once
   * a database detached from it wrote its last commits.
   */
  attach(storage: Storage): Promise<void>
  /**
   * Stop storing commits once the ones so far are written; later commits
   * change only the memory copy.
   */
  detach(): void
}

/**
 * Page cache in KiB. SQLite's default of 2 MB holds only 32 of the 64 KB
 * pages a browser store uses: a large sync then copies pages in and out of
 * the database memory over and over, which halves its speed.
 */
const cacheSize = -16384

function wasmHandle(
  sqlite: WasmSqlite,
  options?: DatabaseOptions
): WasmDatabaseHandle {
  sqlite.run(`pragma cache_size = ${cacheSize}`)
  return {
    database: connect(sqlite, options),
    driver: 'wasm',
    fork: async () => wasmHandle(sqlite.fork(), options),
    export: () => sqlite.export(),
    flush: () => sqlite.flush(),
    attach: storage => sqlite.attach(storage),
    detach: () => sqlite.detach()
  }
}

/**
 * Open a WASM connection from the database kept in storage, or an empty one,
 * that stores every commit there.
 */
export async function syncWasmDatabase(
  storage: Storage,
  options?: DatabaseOptions
): Promise<WasmDatabaseHandle> {
  const {default: init} = await import('@alinea/sqlite-wasm')
  const {Database} = await init()
  return wasmHandle(await Database.sync(storage), options)
}

/** Open an in-memory WASM connection, optionally from a complete SQLite file. */
export async function openWasmDatabase(
  data?: Uint8Array,
  options?: DatabaseOptions
): Promise<WasmDatabaseHandle> {
  const {default: init} = await import('@alinea/sqlite-wasm')
  const {Database} = await init()
  return wasmHandle(new Database(data), options)
}

export async function wasmDatabase(data?: Uint8Array) {
  return (await openWasmDatabase(data)).database
}
