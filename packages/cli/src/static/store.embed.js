import init from '@alinea/sqlite-wasm'
import {createId} from '@alineacms/core'
import {SqlJsDriver} from '@alineacms/store/sqlite/drivers/SqlJsDriver.js'
import {SqliteStore} from '@alineacms/store/sqlite/SqliteStore.js'
import {decode} from 'base64-arraybuffer'

const buffer = decode('$DB')

export function createStore() {
  return init().then(({Database}) => {
    return new SqliteStore(
      new SqlJsDriver(new Database(new Uint8Array(buffer))),
      createId
    )
  })
}
