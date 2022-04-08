import sqlite from '@alinea/sqlite-wasm'
import {createId} from '@alineacms/core'
import BetterSqlite3Database from 'better-sqlite3'
import {BetterSqlite3Driver} from '../src/sqlite/drivers/BetterSqlite3Driver'
import {SqlJsDriver} from '../src/sqlite/drivers/SqlJsDriver'
import {SqliteStore} from '../src/sqlite/SqliteStore'

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
