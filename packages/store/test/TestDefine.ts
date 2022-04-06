import {test} from 'uvu'
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
  const Entry = new Collection<Entry>('Entry').define(fields => ({
    path: fields.type
      .concat('-')
      .concat(SqliteFunctions.cast(fields.num, 'text'))
  }))
  db.insert(Entry, {
    id: 'entry',
    type: 'Entry',
    num: 123
  })
  Entry.path
})

test.run()
