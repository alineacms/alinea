import {suite} from '@alinea/suite'
import {LocalDB} from 'alinea/core/db/LocalDB.js'
import {FSSource} from 'alinea/core/source/FSSource'
import {MemorySource} from 'alinea/core/source/MemorySource.js'
import {syncWith} from 'alinea/core/source/Source.js'
import {cms} from './cms.js'

const test = suite(import.meta)
const source = new FSSource('apps/web/content/demo')
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
