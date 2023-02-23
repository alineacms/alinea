import init from '@alinea/sqlite-wasm'
import {createId} from 'alinea/core'
import {SqlJsDriver} from 'alinea/store/sqlite/drivers/SqlJsDriver'
import {SqliteStore} from 'alinea/store/sqlite/SqliteStore'
import * as storeExports from './$WASM'

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

export function createStore() {
  return Promise.all([getWasmInstance(storeExports), init()]).then(
    ([{exports}, {Database}]) =>
      new SqliteStore(new SqlJsDriver(new Database(unpack(exports))), createId)
  )
}
