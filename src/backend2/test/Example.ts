import sqlite from '@alinea/sqlite-wasm'
import {Database} from 'alinea/backend2/Database'
import {
  createConfig,
  schema as createSchema,
  root,
  type,
  workspace
} from 'alinea/core'
import {path, tab, tabs, text} from 'alinea/input'
import {SourceEntry} from '../Source.js'

import {connect} from 'rado/driver/sql.js'

const encode = (data: any) => new TextEncoder().encode(JSON.stringify(data))

export namespace Example {
  const entry1: SourceEntry = {
    modifiedAt: Date.now(),
    workspace: 'main',
    root: 'pages',
    filePath: 'index.json',
    contents: encode({
      id: 'root',
      type: 'TypeA',
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
    root: 'pages',
    filePath: 'index/entry2.json',
    contents: encode({
      id: 'entry2',
      type: 'TypeA',
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
    root: 'pages',
    filePath: 'index/entry2/entry3.json',
    contents: encode({
      id: 'entry3',
      type: 'TypeB',
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
    title: text('Title'),
    path: path('Path'),
    ...tabs(
      tab('Tab 1', {
        namesdf: text('Name'),
        name: path('Name')
      }),
      tab('Tab 2', {
        name: text('Name'),
        name2: text('Name')
      })
    ),
    [type.meta]: {
      isContainer: true
    }
  })

  const TypeB = type('TypeB', {
    title: text('Title'),
    path: path('Path'),
    name: text('name'),
    [type.meta]: {
      isContainer: true
    }
  })

  export const schema = createSchema({TypeA, TypeB})
  export type Schema = typeof schema

  const main = workspace('Main', {
    pages: root('Pages', {contains: ['Type']}),
    media: root('Media', {contains: ['Type']}),
    [workspace.meta]: {
      source: '.'
    }
  })

  export const cms = createConfig({
    schema,
    workspaces: {main}
  })

  export async function* files() {
    yield* [entry1, entry2, entry3]
  }

  export async function createDb() {
    const {Database: SqlJsDb} = await sqlite()
    return new Database(connect(new SqlJsDb()).toAsync(), cms)
  }
}
