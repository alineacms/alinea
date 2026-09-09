import {connect} from 'rado/driver/sql.js'

/** Open an in-memory WASM connection, optionally from a complete SQLite file. */
export async function wasmDatabase(data?: Uint8Array) {
  const {default: init} = await import('@alinea/sqlite-wasm')
  const {Database} = await init()
  const sqlite = new Database(data)
  const prepare = sqlite.prepare.bind(sqlite)
  sqlite.prepare = (sql, params) => {
    const statement = prepare(sql, params)
    const get = statement.get.bind(statement)
    // This WASM build returns views into SQLite's reusable column memory.
    // Copy before Rado steps/reset/finalizes, including getAsObject's get().
    statement.get = params =>
      get(params).map(value =>
        value instanceof Uint8Array ? value.slice() : value
      )
    return statement
  }
  return connect(sqlite)
}
