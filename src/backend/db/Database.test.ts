import sqlite from '@alinea/sqlite-wasm'
import {connect} from 'rado/driver/sql.js'
import {test} from 'uvu'
import {Database, EntryRaw} from './Database.js'

const entry1: EntryRaw = {
  lastModified: Date.now(),
  id: 'root',
  type: 'Type',
  title: 'Test title',
  path: '/',
  url: '/',
  alinea: {
    index: 'a0',
    parent: undefined,
    parents: [],
    workspace: 'main',
    root: 'data'
  }
}

const entry2: EntryRaw = {
  lastModified: Date.now(),
  id: 'entry2',
  type: 'Type',
  title: 'Test title',
  path: '/entry2',
  url: '/entry2',
  alinea: {
    index: 'a0',
    parent: entry1.id,
    parents: [entry1.id],
    workspace: 'main',
    root: 'data'
  }
}

const entry3: EntryRaw = {
  lastModified: Date.now(),
  id: 'entry3',
  type: 'Type',
  title: 'Test title',
  path: '/entry3',
  url: '/entry3',
  alinea: {
    index: 'a0',
    parent: entry2.id,
    parents: [entry1.id, entry2.id],
    workspace: 'main',
    root: 'data'
  }
}

async function* entries() {
  yield* [entry1, entry2, entry3]
}

test('create', async () => {
  const {Database: SqlJsDb} = await sqlite()
  const cnx = connect(new SqlJsDb())
  const db = new Database(cnx.toAsync())
  await db.fill(entries())
  console.log(await db.state())
})

test.run()
