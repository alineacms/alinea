import {connect} from 'rado/driver/sql.js'

/** Open an in-memory WASM connection, optionally from a complete SQLite file. */
export async function wasmDatabase(data?: Uint8Array) {
  const {default: init} = await import('@alinea/sqlite-wasm')
  const {Database} = await init()
  const sqlite = new Database(data)
  return connect(sqlite)
}
