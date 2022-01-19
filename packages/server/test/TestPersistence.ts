import {Cache} from '@alinea/cache'
import {createSchema} from '@alinea/core/Schema'
import {type} from '@alinea/core/Type'
import {path} from '@alinea/input.path'
import {text} from '@alinea/input.text'
import {Volume} from 'memfs'
import {test} from 'uvu'
import * as assert from 'uvu/assert'
import {FSPersistence} from '../src/content/FSPersistence'

const schema = createSchema({
  Type: type('Type', {
    title: text('title'),
    path: path('path')
  })
})
const {Type} = schema.collections
const fs = Volume.fromJSON({
  '/index.json': JSON.stringify({
    type: 'Type'
  })
})

const index = Cache.fromMemory({schema, dir: 'content'})
const persistence = new FSPersistence(fs.promises, index, 'content')

test('it works', async () => {
  const store = await index.store
  assert.ok(store.first(Type))
})

test.run()
