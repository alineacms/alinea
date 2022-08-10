import {Storage} from '@alinea/backend/Storage'
import {
  accumulate,
  createConfig,
  Entry,
  ErrorWithCode,
  outcome,
  root,
  schema as createSchema,
  type,
  workspace
} from '@alinea/core'
import {text} from '@alinea/input.text'
import {Volume} from 'memfs'
import {test} from 'uvu'
import * as assert from 'uvu/assert'
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
          contains: ['Type']
        })
      }
    })
  }
})

const fs: FS = Volume.fromNestedJSON({
  content: {
    data: {
      '/index.json': entry({
        title: 'Test title',
        alinea: {
          id: 'root',
          type: 'Home',
          root: 'data',
          index: 'a0'
        }
      }),
      '/sub.json': entry({
        title: 'Sub title',
        alinea: {
          id: 'sub',
          type: 'Type',
          root: 'data',
          index: 'a0'
        }
      }),
      sub: {
        '/entry.json': entry({
          title: 'Sub entry title',
          alinea: {
            id: 'sub-entry',
            type: 'Sub',
            root: 'data',
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

const data = new FileData({
  config,
  fs,
  loader: JsonLoader
})

const store = await createMemoryStore()

test('reading', async () => {
  const entries = await accumulate(data.entries())
  entries.sort((a, b) => a.alinea.url.localeCompare(b.alinea.url))
  const [root, sub, subEntry] = entries
  assert.is(root.alinea.id, 'root')
  assert.is(root.alinea.parent, undefined)
  assert.is(root.alinea.url, '/')
  assert.is(sub.alinea.id, 'sub')
  assert.is(sub.alinea.parent, undefined)
  assert.is(sub.alinea.url, '/sub')
  assert.is(subEntry.alinea.id, 'sub-entry')
  assert.is(subEntry.alinea.parent, 'sub')
  assert.is(subEntry.alinea.url, '/sub/entry')
})

test('inserting', async () => {
  const [root] = await accumulate(data.entries())
  const changes = await Storage.publishChanges(config, store, JsonLoader, [
    {...root, title: 'New root title'}
  ])
  await data.publish({changes})
  const [newRoot] = await accumulate(data.entries())
  assert.is(newRoot.alinea.id, 'root')
  assert.is(newRoot.title, 'New root title')
})

test('file media', async () => {
  const file01 = await data.download({
    workspace: 'main',
    location: 'file01.txt'
  })
  if (file01.type !== 'buffer') throw 'Buffer expected'
  assert.is(file01.buffer.toString(), 'content01')
  const uploadPath = await data.upload({
    workspace: 'main',
    root: 'data',
    path: 'file04.txt',
    buffer: Buffer.from('content04')
  })
  const file04 = await data.download({workspace: 'main', location: uploadPath})
  if (file04.type !== 'buffer') throw 'Buffer expected'
  assert.is(file04.buffer.toString(), 'content04')
  const [, err1] = await outcome(
    data.download({workspace: 'main', location: '../out.txt'})
  )
  assert.is((err1 as ErrorWithCode).code, 401)
})

test.run()
