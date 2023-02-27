import {Collection} from 'alinea/store/Collection'
import {SqliteFunctions} from 'alinea/store/sqlite/SqliteFunctions'
import {test} from 'uvu'
import * as assert from 'uvu/assert'
import {store} from './DbSuite.js'

type Entry = {
  id: string
  type: string
  num: number
}

test('define', () => {
  const db = store()
  const Entry = new Collection<Entry>('Entry')
  const EntryWithPath = Collection.extend(Entry, fields => ({
    path: fields.type
      .concat('-')
      .concat(SqliteFunctions.cast(fields.num, 'text'))
  }))
  db.insert(Entry, {
    id: 'entry',
    type: 'Entry',
    num: 123
  })
  const res = db.first(EntryWithPath)!
  assert.is(res.path, 'Entry-123')

  const Aliased = EntryWithPath.as('Aliased')
  const res2 = db.first(Aliased)!
  assert.is(res2.path, 'Entry-123')
})

test.run()
