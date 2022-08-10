import {Storage} from '@alinea/backend/Storage'
import {
  accumulate,
  createConfig,
  Entry,
  root,
  schema as createSchema,
  type,
  workspace
} from '@alinea/core'
import {text} from '@alinea/input.text'
import {Volume} from 'memfs'
import {test} from 'uvu'
import * as assert from 'uvu/assert'
import {Cache} from '../src'
import {FileData} from '../src/data/FileData'
import {FS} from '../src/FS'
import {JsonLoader} from '../src/loader/JsonLoader'
import {createMemoryStore} from './fixture/CreateMemoryStore'

function entry(entry: Entry.Raw) {
  return JSON.stringify(entry)
}

const config = createConfig({
  workspaces: {
    main: workspace('Main', {
      source: 'content',
      mediaDir: 'files',
      schema: createSchema({
        Home: type('Home', {
          title: text('Title')
        }),
        Type: type('Type', {
          title: text('Title')
        }).configure({isContainer: true}),
        Sub: type('Sub', {
          title: text('Title')
        })
      }),
      roots: {
        data: root('Root', {
          contains: ['Type'],
          i18n: {
            locales: ['a', 'b']
          }
        })
      }
    })
  }
})

const fs: FS = Volume.fromNestedJSON({
  content: {
    data: {
      a: {
        '/index.json': entry({
          title: 'Test title',
          alinea: {
            id: 'root',
            type: 'Home',
            root: 'data',
            index: 'a',
            i18n: {id: 'root'}
          }
        }),
        '/sub.json': entry({
          title: 'Sub title',
          alinea: {
            id: 'sub',
            type: 'Type',
            root: 'data',
            index: 'a',
            i18n: {id: 'sub'}
          }
        }),
        sub: {
          '/entry.json': entry({
            title: 'Sub entry title',
            alinea: {
              id: 'sub-entry',
              type: 'Sub',
              root: 'data',
              index: 'b',
              i18n: {id: 'sub-entry'}
            }
          })
        }
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

const data = new FileData({
  config,
  fs,
  loader: JsonLoader
})

const store = await createMemoryStore()

async function index() {
  const entries = await accumulate(data.entries())
  await Cache.create(store, config, data)
  return entries.sort((a, b) => a.alinea.url.localeCompare(b.alinea.url))
}

test('reading', async () => {
  const [root, sub, subEntry] = await index()
  assert.is(root.alinea.id, 'root')
  assert.is(root.alinea.parent, undefined)
  assert.is(root.alinea.url, '/a')
  assert.is(sub.alinea.id, 'sub')
  assert.is(sub.alinea.parent, undefined)
  assert.is(sub.alinea.url, '/a/sub')
  assert.is(subEntry.alinea.id, 'sub-entry')
  assert.is(subEntry.alinea.parent, 'sub')
  assert.is(subEntry.alinea.url, '/a/sub/entry')
})

test('inserting', async () => {
  const [root] = await index()
  const changes = await Storage.publishChanges(config, store, JsonLoader, [
    {...root, title: 'New root title'}
  ])
  await data.publish({changes})
  const [newRoot] = await index()
  assert.is(newRoot.alinea.id, 'root')
  assert.is(newRoot.title, 'New root title')
  assert.is(newRoot.alinea.url, '/a')
})

test.run()
