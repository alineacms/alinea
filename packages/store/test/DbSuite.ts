import {createId} from '@alinea/core'
// import Database from 'better-sqlite3'
import sqlJs from 'sql.js-fts5'
import {SqlJsDriver} from '../src/sqlite/drivers/SqlJsDriver'
import {SqliteStore} from '../src/sqlite/SqliteStore'

const {Database} = await sqlJs()

export function store() {
  return new SqliteStore(
    // new BetterSqlite3Driver(new Database(':memory:')),
    new SqlJsDriver(new Database()),
    createId
  )
}
