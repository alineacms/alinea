import {createId} from '@alinea/core'
import {decode} from 'base64-arraybuffer'
import {SqlJs} from 'helder.store/sqlite/drivers/SqlJs.js'
import {SqliteStore} from 'helder.store/sqlite/SqliteStore.js'

const sqlJs = decode('$SQLJS')
const buffer = decode('$DB')

const sqlJsInit = SqlJs.init({
  instantiateWasm(imports, resolve) {
    const module = new WebAssembly.Module(sqlJs)
    const instance = new WebAssembly.Instance(module, imports)
    resolve(instance)
    return instance.exports
  }
})

export function createCache() {
  return sqlJsInit.then(() => {
    return () =>
      new SqliteStore(
        new SqlJs(new __sqlJs.Database(new Uint8Array(buffer))),
        createId
      )
  })
}
