import {connect} from 'rado/driver/sql.js'

export interface WasmDatabaseHandle {
  database: ReturnType<typeof connect>
  export(): Uint8Array
}

/** Open an in-memory WASM connection, optionally from a complete SQLite file. */
export async function openWasmDatabase(
  data?: Uint8Array
): Promise<WasmDatabaseHandle> {
  const {default: init} = await import('@alinea/sqlite-wasm')
  const {Database} = await init()
  const sqlite = new Database(data)
  return {
    database: connect(sqlite),
    export: () => sqlite.export()
  }
}

export async function wasmDatabase(data?: Uint8Array) {
  return (await openWasmDatabase(data)).database
}
