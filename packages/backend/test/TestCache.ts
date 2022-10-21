import {
  createConfig,
  createId,
  Entry,
  root,
  schema as createSchema,
  type,
  workspace
} from '@alinea/core'
import {text} from '@alinea/input.text'
import sqlite from '@alinea/sqlite-wasm'
import {SqlJsDriver} from '@alinea/store/sqlite/drivers/SqlJsDriver'
import {SqliteStore} from '@alinea/store/sqlite/SqliteStore'
import {Volume} from 'memfs'
import {test} from 'uvu'
import {Cache} from '../src'
import {FileData} from '../src/data/FileData'
import {FS} from '../src/FS'
import {JsonLoader} from '../src/loader/JsonLoader'

function entry(entry: Entry.Raw) {
  return JSON.stringify(entry)
}

const config = createConfig({
  schema: createSchema({
    Type: type('Type', {
      title: text('Title'),
      path: text('path')
    }).configure({
      isContainer: true
    }),
    Sub: type('Sub', {
      title: text('Title'),
      path: text('path')
    })
  }),
  workspaces: {
    main: workspace('Main', {
      source: 'content',
      roots: {data: root('Root', {contains: ['Type']})}
    })
  }
})

const fs: FS = Volume.fromNestedJSON({
  content: {
    data: {
      '/index.json': entry({
        id: 'root',
        type: 'Type',
        title: 'Test title',
        alinea: {
          index: 'a0'
        }
      }),
      sub: {
        '/index.json': entry({
          id: 'sub',
          type: 'Type',
          title: 'Sub title',
          alinea: {
            index: 'a0'
          }
        }),
        '/entry.json': entry({
          id: 'sub-entry',
          type: 'Sub',
          title: 'Sub entry title',
          alinea: {
            index: 'a0'
          }
        })
      }
    }
  },
  files: {
    '/file01.txt': 'content01',
    '/file02.txt': 'content02',
    '/sub': {
      '/file03.txt': 'content01'
    }
  }
}).promises as any

const data = new FileData({config, fs, loader: JsonLoader})

test('create', async () => {
  const {Database} = await sqlite()
  const store = new SqliteStore(new SqlJsDriver(new Database()), createId)
  await Cache.create({store, config, from: data})
})

test.run()
