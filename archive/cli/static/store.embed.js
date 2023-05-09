import init from '@alinea/sqlite-wasm'
import {createId} from 'alinea/core'
import {base64} from 'alinea/core/util/Encoding'
import {SqlJsDriver} from 'alinea/store/sqlite/drivers/SqlJsDriver'
import {SqliteStore} from 'alinea/store/sqlite/SqliteStore'

const buffer = base64.parse('$DB')

export function createStore() {
  return init().then(({Database}) => {
    return new SqliteStore(
      new SqlJsDriver(new Database(new Uint8Array(buffer))),
      createId
    )
  })
}
