import {Entry} from '@alinea/core/Entry'
import {createSchema} from '@alinea/core/Schema'
import {type} from '@alinea/core/Type'
import {text} from '@alinea/input.text'
import {Volume} from 'memfs'
import {test} from 'uvu'
import * as assert from 'uvu/assert'
import {FS} from '../src/FS'
import {JsonLoader} from '../src/loader/JsonLoader'
import {FileSource} from '../src/source/FileSource'

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
  }
}).promises as any

const source = new FileSource({schema, fs, dir: 'content', loader: JsonLoader})

async function toArray<T>(gen: AsyncGenerator<T>): Promise<Array<T>> {
  const arr = []
  for await (const i of gen) arr.push(i)
  return arr
}

test('reading', async () => {
  const [root, sub, subEntry] = await toArray(source.entries())
  assert.is(root.id, 'root')
  assert.is(root.url, '/')
  assert.is(sub.id, 'sub')
  assert.is(sub.$parent, undefined)
  assert.is(sub.url, '/sub')
  assert.is(subEntry.id, 'sub-entry')
  assert.is(subEntry.$parent, 'sub')
  assert.is(subEntry.url, '/sub/entry')
})

test('inserting', async () => {
  const [root] = await toArray(source.entries())
  await source.publish([{...root, title: 'New root title'}])
  const [newRoot] = await toArray(source.entries())
  assert.is(newRoot.id, 'root')
  assert.is(newRoot.title, 'New root title')
})

test.run()
