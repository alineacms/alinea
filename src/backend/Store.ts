import {decode} from 'buffer-to-base64'
import PLazy from 'p-lazy'
import {Database} from 'rado'
import {connect} from 'rado/driver/sql.js'

export type Store = Database

export async function createStore(data?: Uint8Array): Promise<Store> {
  const {default: sqlInit} = await import('@alinea/sqlite-wasm')
  const {Database} = await sqlInit()
  const cnx = connect(new Database(data))
  return cnx
}

export const generatedStore: Promise<Store> = PLazy.from(async () => {
  // @ts-ignore
  const {storeData} = await import('@alinea/generated/store.js')
  return createStore(new Uint8Array(await decode(storeData)))
})
