import sqlite from '@alinea/sqlite-wasm'
import {createId} from 'alinea/core'
import {SqlJsDriver} from 'alinea/store/sqlite/drivers/SqlJsDriver'
import {SqliteStore} from 'alinea/store/sqlite/SqliteStore'

export async function createMemoryStore(wasm = false) {
  return new SqliteStore(
    new SqlJsDriver(new (await sqlite()).Database()),
    createId
  )
}
