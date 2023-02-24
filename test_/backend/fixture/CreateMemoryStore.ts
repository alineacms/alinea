import sqlite from '@alinea/sqlite-wasm'
import {createId} from 'alinea/core'
import {BetterSqlite3Driver} from 'alinea/store/sqlite/drivers/BetterSqlite3Driver'
import {SqlJsDriver} from 'alinea/store/sqlite/drivers/SqlJsDriver'
import {SqliteStore} from 'alinea/store/sqlite/SqliteStore'
import Database from 'better-sqlite3'

export async function createMemoryStore(wasm = false) {
  return new SqliteStore(
    wasm
      ? new SqlJsDriver(new (await sqlite()).Database())
      : new BetterSqlite3Driver(new Database(':memory:')),
    createId
  )
}
