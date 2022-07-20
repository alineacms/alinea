import {createId} from '@alinea/core'
import sqlite from '@alinea/sqlite-wasm'
import {SqlJsDriver} from '@alinea/store/sqlite/drivers/SqlJsDriver'
import {SqliteStore} from '@alinea/store/sqlite/SqliteStore'

export function createStore() {
  return sqlite().then(
    ({Database}) => new SqliteStore(new SqlJsDriver(new Database()), createId)
  )
}
