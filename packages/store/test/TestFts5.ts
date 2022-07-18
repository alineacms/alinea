import {test} from 'uvu'
import * as assert from 'uvu/assert'
import {Expr} from '../src'
import {Collection} from '../src/Collection'
import {store} from './DbSuite'

const Search = new Collection<{id: string; title: string; body: string}>(
  'Search',
  {
    flat: true,
    columns: ['id', 'title', 'body']
  }
)

test('Fts5', () => {
  const db = store()
  db.createFts5Table(Search, 'Search', search => {
    return {title: search.title, body: search.body}
  })
  const record1 = db.insert(Search, {
    title: 'my title',
    body: 'my bodytext'
  })
  const record2 = db.insert(Search, {title: 'c', body: 'd'})
  assert.is(
    db.sure(Search.where(Search.title.match('my'))).title,
    record1.title
  )
  assert.is(db.sure(Search.where(Search.title.match('c'))).id, record2.id)
  const addFields = db.sure(
    Search.where(Search.title.match('my')).select(
      Search.with({
        int: Expr.value(123)
      })
    )
  )
  assert.is(addFields.int, 123)
  assert.is(addFields.title, record1.title)
})

test('Re-create', () => {
  const db = store()
  db.createFts5Table(Search, 'Search', search => {
    return {title: search.title, body: search.body}
  })
  db.createFts5Table(Search, 'Search', search => {
    return {title: search.title, body: search.body}
  })
  db.createFts5Table(Search, 'Search', search => {
    return {title: search.title, body: search.body}
  })
})

test.run()
