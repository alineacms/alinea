import {suite} from '@alinea/suite'
import {LocalDB} from '#/core/db/LocalDB.js'
import {FSSource} from '#/core/source/FSSource.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {syncWith} from '#/core/source/Source.js'
import {cms} from './cms.js'

const test = suite(import.meta)
const dir = 'src/test/fixtures/demo'
const source = new FSSource(dir)
const copy = new MemorySource()
await syncWith(copy, source)
const db = new LocalDB(cms, copy)
await db.sync()

test('move in between duplicate indexes', async () => {
  const siblings = await db.find({
    root: 'media'
  })
  await db.move({
    id: 'sw3j0F5a-lzQ9ubqYuS53',
    target: siblings[0]._id,
    dropPosition: 'before'
  })
  const moved = await db.find({
    root: 'media'
  })
  test.equal(
    moved.map(entry => entry._index),
    ['a0', 'a1', 'a2', 'a3', 'a4']
  )
})
