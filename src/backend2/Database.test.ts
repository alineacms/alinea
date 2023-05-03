import sqlite from '@alinea/sqlite-wasm'
import {Schema, createConfig, root, schema, type, workspace} from 'alinea/core'
import {Logger, Report} from 'alinea/core/util/Logger'
import {path, tab, tabs, text} from 'alinea/input'
import * as fs from 'fs/promises'
import {connect} from 'rado/driver/sql.js'
import {test} from 'uvu'
import {Database} from './Database.js'
import {SourceEntry} from './Source.js'
import {FileData} from './data/FileData.js'

const encode = (data: any) => new TextEncoder().encode(JSON.stringify(data))

const entry1: SourceEntry = {
  modifiedAt: Date.now(),
  workspace: 'main',
  root: 'data',
  filePath: 'index.json',
  contents: encode({
    id: 'root',
    type: 'Type',
    title: 'Test title',
    path: '/',
    url: '/',
    alinea: {
      index: 'a0',
      parent: undefined,
      parents: []
    }
  })
}

const entry2: SourceEntry = {
  modifiedAt: Date.now(),
  workspace: 'main',
  root: 'data',
  filePath: 'index/entry2.json',
  contents: encode({
    id: 'entry2',
    type: 'Type',
    title: 'Entry 2',
    path: '/entry2',
    url: '/entry2',
    alinea: {
      index: 'a0',
      parent: undefined,
      parents: []
    }
  })
}

const entry3: SourceEntry = {
  modifiedAt: Date.now(),
  workspace: 'main',
  root: 'data',
  filePath: 'index/entry2/entry3.json',
  contents: encode({
    id: 'entry3',
    type: 'Type',
    title: 'Entry 3',
    path: '/entry3',
    url: '/entry3',
    alinea: {
      index: 'a0',
      parent: undefined,
      parents: []
    }
  })
}

export const entries = [entry1, entry2, entry3]

const TypeA = type('Type', {
  /** Testje */
  title: text('Title'),
  /** Testje */
  path: path('Path'),
  ...tabs(
    tab('Tab 1', {
      namesdf: text('Name'),
      name: text('Name')
    }),
    tab('Tab 2', {
      name1: text('Name'),
      name2: text('Name')
    })
  ),
  [type.meta]: {
    isContainer: true
  }
})

type TypeA = Schema.Infer<typeof TypeA>

const TypeB = type('TypeB', {
  title: text('Title'),
  path: path('Path'),
  name: text('name'),
  [type.meta]: {
    isContainer: true
  }
})

export const config = createConfig({
  schema: schema({TypeA, TypeB}),
  workspaces: {
    main: workspace('Main', {
      source: '.',
      roots: {
        data: root('Data', {
          contains: ['Type']
        }),
        media: root('Media', {
          contains: ['Type']
        })
      }
    })
  }
})

export type ExampleSchema = Schema.Infer<typeof config.schema>

export async function* files() {
  yield* [entry1, entry2, entry3]
}

export async function createDb() {
  const {Database: SqlJsDb} = await sqlite()
  return new Database(connect(new SqlJsDb()).toAsync(), config)
}

test('create', async () => {
  const db1 = await createDb()
  await db1.fill(files())
  console.log(await db1.meta())

  const {Database: SqlJsDb} = await sqlite()
  const cnx2 = connect(new SqlJsDb())
  const db2 = new Database(cnx2.toAsync(), config)
  await db2.init()
  await db2.syncWith(db1)

  console.log(await db2.meta())
})

test.only('filedata', async () => {
  const data = new FileData({
    config,
    fs,
    rootDir: './apps/web/content'
  })
  const {default: BetterSqlite3} = await import('better-sqlite3')
  const {connect} = await import('rado/driver/better-sqlite3')
  const cnx1 = connect(new BetterSqlite3('dist/test.db'))
  const db = new Database(cnx1.toAsync(), config)
  const logger = new Logger('test')
  await db.init()
  const endTimer = logger.time('fill')
  await db.fill(data.entries())
  endTimer()
  Report.toConsole(logger.report())
  console.log(await db.meta())
})

test.run()
