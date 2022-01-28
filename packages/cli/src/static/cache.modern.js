import {createId} from '@alinea/core'
import {SqlJs} from 'helder.store/sqlite/drivers/SqlJs.js'
import {SqliteStore} from 'helder.store/sqlite/SqliteStore.js'
import * as cacheExports from './cache.wasm'

function unpack(exports) {
  return new Uint8Array(exports.data.buffer, 0, exports.length.value)
}

async function getWasmInstance(exports, imports) {
  if (exports.default) return getWasmInstance(exports.default)
  if (typeof exports === 'function') return {exports: await exports()}
  if (exports instanceof WebAssembly.Module) {
    return WebAssembly.instantiate(module, imports)
  }
  if (exports && typeof exports === 'object') return {exports}
  throw new Error('Unable to load wasm module')
}

const buffer = unpack((await getWasmInstance(cacheExports)).exports)

await SqlJs.init({
  /*
  import sqlWasm from '....sql-wasm.wasm'
  instantiateWasm(imports, successCallback) {
    const instance = new WebAssembly.Instance(sqlWasm, imports)
    successCallback(instance)
    return instance.exports
  }*/
})

export const createCache = () =>
  new SqliteStore(new SqlJs(new __sqlJs.Database(buffer)), createId)
