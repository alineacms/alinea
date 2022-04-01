import {
  createConfig,
  createId,
  Entry,
  schema as createSchema,
  type,
  workspace
} from '@alinea/core'
import {text} from '@alinea/input.text'
import sqlite from '@alinea/sqlite-wasm'
import {Store} from '@alinea/store'
import {SqlJsDriver} from '@alinea/store/sqlite/drivers/SqlJsDriver'
import {SqliteStore} from '@alinea/store/sqlite/SqliteStore'
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
    parents: ['root']
  },
  {
    id: 'sub-entry',
    type: 'Sub',
    title: 'Sub entry title',
    index: 'a0',
    workspace: 'main',
    root: 'main',
    url: '/sub/entry',
    parents: ['root', 'sub']
  }
]

const source = {
  async *entries(): AsyncGenerator<Entry> {
    for (const entry of entries) yield entry
  }
}

export default async function createExample(): Promise<Store> {
  const {Database} = await sqlite()
  const store = new SqliteStore(new SqlJsDriver(new Database()), createId)
  await Cache.create(store, config, source)
  return store
}
