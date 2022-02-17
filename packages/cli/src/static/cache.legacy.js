import {createId} from '@alinea/core'
import {SqlJsDriver} from '@alinea/store/sqlite/drivers/SqlJsDriver.js'
import {SqliteStore} from '@alinea/store/sqlite/SqliteStore.js'
import {decode} from 'base64-arraybuffer'
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
      new SqlJsDriver(new Database(new Uint8Array(buffer))),
      createId
    )
  })
}
