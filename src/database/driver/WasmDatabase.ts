import type {Database as WasmSqlite} from '@alinea/sqlite-wasm/Database.js'
import type {DatabaseOptions} from 'rado'
import {connect} from 'rado/driver/sql.js'
import type {DatabaseHandle} from './DatabaseHandle.js'

export interface WasmDatabaseHandle extends DatabaseHandle {
  database: ReturnType<typeof connect>
  fork(): Promise<WasmDatabaseHandle>
  export(): Uint8Array
}

function wasmHandle(
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
  return wasmHandle(new Database(data), options)
}

export async function wasmDatabase(data?: Uint8Array) {
  return (await openWasmDatabase(data)).database
}
