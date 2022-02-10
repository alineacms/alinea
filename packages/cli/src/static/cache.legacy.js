import {createId} from '@alinea/core'
import {decode} from 'base64-arraybuffer'
import {SqlJs} from 'helder.store/sqlite/drivers/SqlJs.js'
import {SqliteStore} from 'helder.store/sqlite/SqliteStore.js'
import initSqlJs from 'sql.js-fts5'

const sqlJs = decode('$SQLJS')
const buffer = decode('$DB')

const sqlJsInit = initSqlJs({
  instantiateWasm(imports, resolve) {
    const module = new WebAssembly.Module(sqlJs)
    const instance = new WebAssembly.Instance(module, imports)
    resolve(instance)
    return instance.exports
  }
})

export function createCache() {
  return sqlJsInit.then(({Database}) => {
    return new SqliteStore(
      new SqlJs(new Database(new Uint8Array(buffer))),
      createId
    )
  })
}
