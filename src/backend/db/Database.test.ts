import sqlite from '@alinea/sqlite-wasm'
import {createConfig, root, schema, type, workspace} from 'alinea/core'
import {path, text} from 'alinea/input'
import {connect} from 'rado/driver/sql.js'
import {test} from 'uvu'
import {Database, FileInfo} from './Database.js'

const encode = (data: any) => new TextEncoder().encode(JSON.stringify(data))

const entry1: FileInfo = {
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

const entry2: FileInfo = {
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

const entry3: FileInfo = {
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

const config = createConfig({
  schema: schema({
    Type: type('Type', {
      title: text('Title'),
      path: path('Path')
    }).configure({
      isContainer: true
    })
  }),
  workspaces: {
    main: workspace('Main', {
      source: '.',
      roots: {
        data: root('Data', {
          contains: ['Type']
        })
      }
    })
  }
})

async function* files() {
  yield* [entry1, entry2, entry3]
}

test('create', async () => {
  const {Database: SqlJsDb} = await sqlite()
  const cnx1 = connect(new SqlJsDb())
  const db1 = new Database(cnx1.toAsync(), config)
  await db1.fill(files())
  console.log(await db1.meta())

  const cnx2 = connect(new SqlJsDb())
  const db2 = new Database(cnx2.toAsync(), config)
  await db2.init()
  await db2.syncWith(db1)

  console.log(await db2.meta())
})

test.run()
