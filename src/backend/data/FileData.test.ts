import {FileData} from 'alinea/backend/data/FileData'
import {FS} from 'alinea/backend/FS'
import {JsonLoader} from 'alinea/backend/loader/JsonLoader'
import {Storage} from 'alinea/backend/Storage'
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
} from 'alinea/core'
import {createMemoryStore} from 'alinea/dev/test/CreateMemoryStore'
import {text} from 'alinea/input/text'
import {Volume} from 'memfs'
import {test} from 'uvu'
import * as assert from 'uvu/assert'

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
        id: 'root',
        type: 'Home',
        title: 'Test title',
        alinea: {
          index: 'a0'
        }
      }),
      '/sub.json': entry({
        id: 'sub',
        type: 'Type',
        title: 'Sub title',
        alinea: {
          index: 'a0'
        }
      }),
      sub: {
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

const data = new FileData({
  config,
  fs,
  loader: JsonLoader
})

const store = await createMemoryStore()

test('reading', async () => {
  const entries = await accumulate(data.entries())
  entries.sort((a, b) => a.url.localeCompare(b.url))
  const [root, sub, subEntry] = entries
  assert.is(root.id, 'root')
  assert.is(root.alinea.parent, undefined)
  assert.is(root.url, '/')
  assert.is(sub.id, 'sub')
  assert.is(sub.alinea.parent, undefined)
  assert.is(sub.url, '/sub')
  assert.is(subEntry.id, 'sub-entry')
  assert.is(subEntry.alinea.parent, 'sub')
  assert.is(subEntry.url, '/sub/entry')
})

test('inserting', async () => {
  const [root] = await accumulate(data.entries())
  const changes = await Storage.publishChanges(config, store, JsonLoader, [
    {...root, title: 'New root title'}
  ])
  await data.publish({changes})
  const [newRoot] = await accumulate(data.entries())
  assert.is(newRoot.id, 'root')
  assert.is(newRoot.title, 'New root title')
})

test('file media', async () => {
  const file01 = await data.download({
    location: 'files/file01.txt'
  })
  if (file01.type !== 'buffer') throw 'Buffer expected'
  assert.is(file01.buffer.toString(), 'content01')
  const uploadPath = await data.upload({
    fileLocation: 'files/file04.txt',
    buffer: Buffer.from('content04')
  })
  const file04 = await data.download({location: uploadPath})
  if (file04.type !== 'buffer') throw 'Buffer expected'
  assert.is(file04.buffer.toString(), 'content04')
  const [, err1] = await outcome(data.download({location: '../out.txt'}))
  assert.is((err1 as ErrorWithCode).code, 401)
})

test.run()
