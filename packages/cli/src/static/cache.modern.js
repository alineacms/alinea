import {createId} from '@alinea/core'
import {SqlJsDriver} from '@alinea/store/sqlite/drivers/SqlJsDriver.js'
import {SqliteStore} from '@alinea/store/sqlite/SqliteStore.js'
import initSqlJs from 'sql.js-fts5'
// Todo: this won't work with the wasm import proposal because we can't pass
// imports to it, so we'll probably end up inlining the wasm code.
import * as sqlExports from 'sql.js-fts5/dist/sql-wasm.wasm'
import * as cacheExports from './cache.wasm'

function unpack(exports) {
  return new Uint8Array(exports.data.buffer, 0, exports.length.value)
}

async function getWasmInstance(exports, imports) {
  if (exports.default) return getWasmInstance(exports.default)
  if (typeof exports === 'function') return {exports: await exports(imports)}
  if (exports instanceof WebAssembly.Module) {
    return WebAssembly.instantiate(module, imports)
  }
  if (exports && typeof exports === 'object') {
    if (imports) throw new Error(`Cannot instantiate wasm module with imports`)
    return {exports}
  }
  throw new Error(`Unable to load wasm module`)
}

const buffer = unpack((await getWasmInstance(cacheExports)).exports)

const sqlJsInit = initSqlJs({
  async instantiateWasm(imports, successCallback) {
    const instance = await getWasmInstance(sqlExports, imports)
    successCallback(instance)
    return instance.exports
  }
})

export function createCache() {
  return sqlJsInit.then(
    ({Database}) =>
      new SqliteStore(new SqlJsDriver(new Database(buffer)), createId)
  )
}
