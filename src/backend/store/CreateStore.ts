import {connect} from 'rado/driver/sql.js'
import type {Store} from '../Store.js'

export async function createStore(data?: Uint8Array): Promise<Store> {
  const {default: sqlInit} = await import('@alinea/sqlite-wasm')
  const {Database} = await sqlInit()
  const cnx = connect(new Database(data))
  return cnx
}
