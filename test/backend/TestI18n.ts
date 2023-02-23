import {Cache} from 'alinea/backend'
import {FileData} from 'alinea/backend/data/FileData'
import {FS} from 'alinea/backend/FS'
import {JsonLoader} from 'alinea/backend/loader/JsonLoader'
import {Storage} from 'alinea/backend/Storage'
import {
  accumulate,
  createConfig,
  Entry,
  root,
  schema as createSchema,
  type,
  workspace
} from 'alinea/core'
import {text} from 'alinea/input/text'
import {Volume} from 'memfs'
import {test} from 'uvu'
import * as assert from 'uvu/assert'
import {createMemoryStore} from './fixture/CreateMemoryStore'

function entry(entry: Entry.Raw) {
  return JSON.stringify(entry)
}

const config = createConfig({
  schema: createSchema({
    Home: type('Home', {
      title: text('Title'),
      path: text('path')
    }),
    Type: type('Type', {
      title: text('Title'),
      path: text('path')
    }).configure({isContainer: true}),
    Sub: type('Sub', {
      title: text('Title'),
      path: text('path')
    })
  }),
  workspaces: {
    main: workspace('Main', {
      source: 'content',
      mediaDir: 'files',
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
          id: 'root',
          type: 'Home',
          title: 'Test title',
          alinea: {
            index: 'a',
            i18n: {id: 'root'}
          }
        }),
        '/sub.json': entry({
          id: 'sub',
          type: 'Type',
          title: 'Sub title',
          alinea: {
            index: 'a',
            i18n: {id: 'sub'}
          }
        }),
        sub: {
          '/entry.json': entry({
            id: 'sub-entry',
            type: 'Sub',
            title: 'Sub entry title',
            alinea: {
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
  await Cache.create({store, config, from: data})
  return entries.sort((a, b) => a.url.localeCompare(b.url))
}

test('reading', async () => {
  const [root, sub, subEntry] = await index()
  assert.is(root.id, 'root')
  assert.is(root.alinea.parent, undefined)
  assert.is(root.url, '/a')
  assert.is(sub.id, 'sub')
  assert.is(sub.alinea.parent, undefined)
  assert.is(sub.url, '/a/sub')
  assert.is(subEntry.id, 'sub-entry')
  assert.is(subEntry.alinea.parent, 'sub')
  assert.is(subEntry.url, '/a/sub/entry')
})

test('inserting', async () => {
  const [root] = await index()
  const changes = await Storage.publishChanges(config, store, JsonLoader, [
    {...root, title: 'New root title'}
  ])
  await data.publish({changes})
  const [newRoot] = await index()
  assert.is(newRoot.id, 'root')
  assert.is(newRoot.title, 'New root title')
  assert.is(newRoot.url, '/a')
})

test.run()
