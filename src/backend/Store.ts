import {Driver} from 'rado'
import {connect} from 'rado/driver/sql.js'

export type Store = Driver.Async

export async function createStore(data?: Uint8Array): Promise<Store> {
  const {default: sqlInit} = await import('@alinea/sqlite-wasm')
  const {Database} = await sqlInit()
  const cnx = connect(new Database(data))
  return cnx.toAsync()
}
