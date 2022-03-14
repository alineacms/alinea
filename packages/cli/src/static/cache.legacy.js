import {createId} from '@alinea/core'
import {Database} from '@alinea/sqlite-wasm'
import {init} from '@alinea/sqlite-wasm/init'
import {SqlJsDriver} from '@alinea/store/sqlite/drivers/SqlJsDriver.js'
import {SqliteStore} from '@alinea/store/sqlite/SqliteStore.js'
import {decode} from 'base64-arraybuffer'

const buffer = decode('$DB')

export function createCache() {
  return init().then(wasm => {
    return new SqliteStore(
      new SqlJsDriver(new Database(wasm, new Uint8Array(buffer))),
      createId
    )
  })
}
