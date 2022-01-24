import {createSchema} from '@alinea/core/Schema'
import {type} from '@alinea/core/Type'
import {path} from '@alinea/input.path'
import {text} from '@alinea/input.text'
import {Cache} from '@alinea/server'
import {Volume} from 'memfs'
import {test} from 'uvu'
import * as assert from 'uvu/assert'
import {FS} from '../src/content/FS'
import {FSPersistence} from '../src/content/FSPersistence'

const schema = createSchema({
  Type: type('Type', {
    title: text('title'),
    path: path('path')
  })
})
const {Type} = schema.collections
const fs: FS = Volume.fromNestedJSON({
  content: {
    '/index.json': JSON.stringify({
      type: 'Type',
      title: 'Test title'
    })
  }
}).promises as any

const index = Cache.fromMemory({schema, dir: 'content', fs: fs})
const persistence = new FSPersistence(fs, index, 'content')

test('it works', async () => {
  const store = await index.store
  const res = store.first(Type)!
  assert.ok(res)
  assert.equal(res.title, 'Test title')
})

test.run()
