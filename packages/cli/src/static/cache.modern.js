import {createId} from '@alinea/core'
import {SqlJs} from 'helder.store/sqlite/drivers/SqlJs.js'
import {SqliteStore} from 'helder.store/sqlite/SqliteStore.js'
import * as sqlExports from 'sql.js/dist/sql-wasm.wasm'
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

export const cache = SqlJs.init({
  async instantiateWasm(imports, successCallback) {
    const instance = await getWasmInstance(sqlExports, imports)
    successCallback(instance)
    return instance.exports
  }
}).then(() => {
  return () =>
    new SqliteStore(new SqlJs(new __sqlJs.Database(buffer)), createId)
})
