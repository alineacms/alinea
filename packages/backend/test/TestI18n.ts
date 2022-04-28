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
import {FileData} from '../src/data/FileData'
import {FS} from '../src/FS'
import {JsonLoader} from '../src/loader/JsonLoader'

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
          id: 'root',
          index: 'a',
          type: 'Home',
          title: 'Test title'
        }),
        '/sub.json': entry({
          id: 'sub',
          index: 'a',
          type: 'Type',
          title: 'Sub title'
        }),
        sub: {
          '/entry.json': entry({
            id: 'sub-entry',
            index: 'b',
            type: 'Sub',
            title: 'Sub entry title'
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

async function getEntries() {
  const entries = await accumulate(data.entries())
  return entries.sort((a, b) => a.url.localeCompare(b.url))
}

test('reading', async () => {
  const [root, sub, subEntry] = await getEntries()
  assert.is(root.id, 'root')
  assert.is(root.parent, undefined)
  assert.is(root.url, '/a')
  assert.is(sub.id, 'sub')
  assert.is(sub.parent, undefined)
  assert.is(sub.url, '/a/sub')
  assert.is(subEntry.id, 'sub-entry')
  assert.is(subEntry.parent, 'sub')
  assert.is(subEntry.url, '/a/sub/entry')
})

test('inserting', async () => {
  const [root] = await getEntries()
  await data.publish([{...root, title: 'New root title'}])
  const [newRoot] = await getEntries()
  assert.is(newRoot.id, 'root')
  assert.is(newRoot.title, 'New root title')
  assert.is(newRoot.url, '/a')
})

test.run()
