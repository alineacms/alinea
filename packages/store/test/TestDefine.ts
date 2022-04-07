import {test} from 'uvu'
import * as assert from 'uvu/assert'
import {Collection} from '../src/Collection'
import {SqliteFunctions} from '../src/sqlite/SqliteFunctions'
import {store} from './DbSuite'

type Entry = {
  id: string
  type: string
  num: number
}

test('define', () => {
  const db = store()
  const Entry = Collection.define(new Collection<Entry>('Entry'), fields => ({
    path: fields.type
      .concat('-')
      .concat(SqliteFunctions.cast(fields.num, 'text'))
  }))
  db.insert(Entry, {
    id: 'entry',
    type: 'Entry',
    num: 123
  })
  const res = db.first(Entry.select(Entry.path))
  assert.is(res, 'Entry-123')
})

test.run()
