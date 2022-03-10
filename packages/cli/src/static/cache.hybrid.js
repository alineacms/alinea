import {createId} from '@alinea/core'
import {SqlJsDriver} from '@alinea/store/sqlite/drivers/SqlJsDriver.js'
import {SqliteStore} from '@alinea/store/sqlite/SqliteStore.js'
import {decode} from 'base64-arraybuffer'
import initSqlJs from 'sql.js-fts5'
import * as cacheExports from './cache.wasm'

const sqlJs = decode('$SQLJS')

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

const sqlJsInit = initSqlJs({
  instantiateWasm(imports, resolve) {
    const module = new WebAssembly.Module(sqlJs)
    const instance = new WebAssembly.Instance(module, imports)
    resolve(instance)
    return instance.exports
  }
})

const dbBuffer = getWasmInstance(cacheExports).then(({exports}) =>
  unpack(exports)
)

export function createCache() {
  return Promise.all([sqlJsInit, dbBuffer]).then(([{Database}, buffer]) => {
    return new SqliteStore(new SqlJsDriver(new Database(buffer)), createId)
  })
}
