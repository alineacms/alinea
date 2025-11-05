import {suite} from '@alinea/suite'
import {LocalDB} from 'alinea/core/db/LocalDB'
import {FSSource} from 'alinea/core/source/FSSource'
import {MemorySource} from 'alinea/core/source/MemorySource'
import {syncWith} from 'alinea/core/source/Source'
import {cms} from './cms.js'

const test = suite(import.meta)
const dir = 'src/test/fixtures/demo'
const source = new FSSource(dir)
const copy = new MemorySource()
await syncWith(copy, source)
const db = new LocalDB(cms, copy)
await db.sync()

test('move in between duplicate indexes', async () => {
  await db.move({
    id: 'sw3j0F5a-lzQ9ubqYuS53',
    after: null
  })
  const siblings = await db.find({
    root: 'media'
  })
  test.equal(
    siblings.map(entry => entry._index),
    ['a0', 'a1', 'a2', 'a3', 'a4']
  )
})
