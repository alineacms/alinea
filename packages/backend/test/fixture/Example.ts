import {
  createConfig,
  createId,
  Entry,
  schema as createSchema,
  type,
  workspace
} from '@alinea/core'
import {text} from '@alinea/input.text'
import {BetterSqlite3Driver} from '@alinea/store/sqlite/drivers/BetterSqlite3Driver'
import {SqliteStore} from '@alinea/store/sqlite/SqliteStore'
import Database from 'better-sqlite3'
import {Cache} from '../../src/Cache'

const config = createConfig({
  workspaces: {
    main: workspace('Main', {
      source: 'content',
      schema: createSchema({
        Type: type('Type', {title: text('Title')}).configure({
          isContainer: true
        }),
        Sub: type('Sub', {
          title: text('Title')
        })
      }),
      roots: {data: {contains: ['Type']}}
    })
  }
})

const entries: Array<Entry> = [
  {
    id: 'root',
    type: 'Type',
    title: 'Test title',
    index: 'a0',
    workspace: 'main',
    root: 'main',
    url: '/',
    parents: []
  },
  {
    id: 'sub',
    type: 'Type',
    title: 'Sub title',
    index: 'a0',
    workspace: 'main',
    root: 'main',
    url: '/sub',
    parent: 'root',
    parents: ['root']
  },
  {
    id: 'sub-entry',
    type: 'Sub',
    title: 'Sub entry title',
    index: 'a0',
    workspace: 'main',
    root: 'main',
    url: '/sub/sub-entry',
    parent: 'sub',
    parents: ['root', 'sub']
  },
  {
    id: 'sub-entry-2',
    type: 'Sub',
    title: 'Sub entry title 2',
    index: 'a1',
    workspace: 'main',
    root: 'main',
    url: '/sub/sub-entry-2',
    parent: 'sub',
    parents: ['root', 'sub']
  }
]

const source = {
  async *entries(): AsyncGenerator<Entry> {
    for (const entry of entries) yield entry
  }
}

export default async function createExample() {
  const store = new SqliteStore(
    new BetterSqlite3Driver(new Database(':memory:')),
    createId
  )
  await Cache.create(store, config, source)
  return {config, store}
}
