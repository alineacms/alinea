import sqlite from '@alinea/sqlite-wasm'
import {Logger, Report} from 'alinea/core/util/Logger'
import * as fs from 'fs/promises'
import {connect} from 'rado/driver/sql.js'
import {test} from 'uvu'
import {Database} from './Database.js'
import {FileData} from './data/FileData.js'
import {Example} from './test/Example.js'

test('create', async () => {
  const db1 = await Example.createDb()
  await db1.init()
  await db1.fill(Example.files())
  console.log(await db1.meta())

  const {Database: SqlJsDb} = await sqlite()
  const cnx2 = connect(new SqlJsDb())
  const db2 = new Database(cnx2.toAsync(), Example.cms)
  await db2.init()
  await db2.syncWith(db1)

  console.log(await db2.meta())
})

test('filedata', async () => {
  const data = new FileData({
    config: Example.cms,
    fs,
    rootDir: './apps/web/content'
  })
  const {default: BetterSqlite3} = await import('better-sqlite3')
  const {connect} = await import('rado/driver/better-sqlite3')
  const cnx1 = connect(new BetterSqlite3('dist/test.db'))
  const db = new Database(cnx1.toAsync(), Example.cms)
  const logger = new Logger('test')
  await db.init()
  const endTimer = logger.time('fill')
  await db.fill(data.entries())
  endTimer()
  Report.toConsole(logger.report())
  console.log(await db.meta())
})

test.run()
