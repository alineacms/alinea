import {createStore as CS} from 'alinea/backend/Store'
import * as storeExports from './$WASM.js'

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
  return getWasmInstance(storeExports)
    .then(({exports}) => unpack(exports))
    .then(CS)
}
