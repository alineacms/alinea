import sqlite from '@alinea/sqlite-wasm'
import {createId} from 'alinea/core'
import {BetterSqlite3Driver} from 'alinea/store/sqlite/drivers/BetterSqlite3Driver'
import {SqlJsDriver} from 'alinea/store/sqlite/drivers/SqlJsDriver'
import {SqliteStore} from 'alinea/store/sqlite/SqliteStore'
import BetterSqlite3Database from 'better-sqlite3'

const {Database} = await sqlite()

const useWasm = true

function createBetterSqlite3Db() {
  return new BetterSqlite3Driver(new BetterSqlite3Database(':memory:'))
}

function createSqliteJsDb() {
  return new SqlJsDriver(new Database())
}

export function store() {
  return new SqliteStore(
    useWasm ? createSqliteJsDb() : createBetterSqlite3Db(),
    createId
  )
}
