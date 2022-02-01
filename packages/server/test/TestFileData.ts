import {Entry} from '@alinea/core/Entry'
import {ErrorWithCode} from '@alinea/core/ErrorWithCode'
import {outcome} from '@alinea/core/Outcome'
import {createSchema} from '@alinea/core/Schema'
import {type} from '@alinea/core/Type'
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

const schema = createSchema({
  Type: type('Type', {
    title: text('Title')
  })
})

const fs: FS = Volume.fromNestedJSON({
  content: {
    '/index.json': entry({
      id: 'root',
      type: 'Type',
      title: 'Test title'
    }),
    sub: {
      '/index.json': entry({
        id: 'sub',
        type: 'Sub',
        title: 'Sub title'
      }),
      '/entry.json': entry({
        id: 'sub-entry',
        type: 'SubEntry',
        title: 'Sub entry title'
      })
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
  schema,
  fs,
  contentDir: 'content',
  mediaDir: 'files',
  loader: JsonLoader
})

async function toArray<T>(gen: AsyncGenerator<T>): Promise<Array<T>> {
  const arr = []
  for await (const i of gen) arr.push(i)
  return arr
}

test('reading', async () => {
  const [root, sub, subEntry] = await toArray(data.entries())
  assert.is(root.id, 'root')
  assert.is(root.$parent, undefined)
  assert.is(root.url, '/')
  assert.is(sub.id, 'sub')
  assert.is(sub.$parent, 'root')
  assert.is(sub.url, '/sub')
  assert.is(subEntry.id, 'sub-entry')
  assert.is(subEntry.$parent, 'sub')
  assert.is(subEntry.url, '/sub/entry')
})

test('inserting', async () => {
  const [root] = await toArray(data.entries())
  await data.publish([{...root, title: 'New root title'}])
  const [newRoot] = await toArray(data.entries())
  assert.is(newRoot.id, 'root')
  assert.is(newRoot.title, 'New root title')
})

test('file media', async () => {
  const file01 = await data.download('file01.txt')
  if (file01.type !== 'buffer') throw 'Buffer expected'
  assert.is(file01.buffer.toString(), 'content01')
  const uploadPath = await data.upload({
    path: 'file04.txt',
    buffer: Buffer.from('content04')
  })
  const file04 = await data.download(uploadPath)
  if (file04.type !== 'buffer') throw 'Buffer expected'
  assert.is(file04.buffer.toString(), 'content04')
  const [, err1] = await outcome(data.download('../out.txt'))
  assert.is((err1 as ErrorWithCode).code, 401)
})

test.run()
