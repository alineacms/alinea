import {test} from 'uvu'
import * as assert from 'uvu/assert'
import {Collection} from '../src/Collection'
import {Expr} from '../src/Expr'
import {store} from './DbSuite'

test('basic', () => {
  const db = store()
  const Node = new Collection<{id: string; index: number}>(`node`)
  const amount = 10
  const objects = Array.from({length: amount}).map((_, index) => ({index}))
  assert.equal(objects.length, amount)
  db.insertAll(Node, objects)
  assert.equal(db.count(Node), amount)
  const stored = db.all(Node)
  const id = stored[amount - 1].id
  assert.equal(
    db.first(
      Node.where(
        Node.index.greaterOrEqual(amount - 1).and(Node.index.less(amount))
      )
    )!.id,
    id
  )
})

test('filters', () => {
  const db = store()
  const Test = new Collection<typeof a & {id: string}>('test')
  const a = {prop: 10}
  const b = {prop: 20}
  db.insertAll(Test, [a, b])
  const gt10 = db.first(Test.where(Test.prop.greater(10)))!
  assert.equal(gt10.prop, 20)
})

test('select', () => {
  const db = store()
  const Test = new Collection<typeof a & {id: string}>('test')
  const a = {propA: 10, propB: 5}
  const b = {propA: 20, propB: 5}
  db.insertAll(Test, [a, b])
  const res = db.all(Test.select(({propA, propB}) => ({a: propA, b: propB})))
  assert.equal(res, [
    {a: 10, b: 5},
    {a: 20, b: 5}
  ])
  const res2 = db.first(
    Test.select(
      Test.fields.with({
        testProp: Expr.value(123)
      })
    )
  )!
  assert.is(res2.testProp, 123)
  const res3 = db.first(Test.select(Expr.value('test')))!
  assert.is(res3, 'test')
  const res4 = db.first(Test.select(Expr.value(true)))!
  assert.is(res4, true)
})

test('update', () => {
  const db = store()
  const Test = new Collection<typeof a & {id: string}>('test')
  const a = {propA: 10, propB: 5}
  const b = {propA: 20, propB: 5}
  db.insertAll(Test, [a, b])
  db.update(Test.where(Test.propA.is(10)), {propA: 15})
  assert.ok(db.first(Test.where(Test.propA.is(15))))
})

/*test('query', () => {
  const db = store()
  const Test = new Collection<typeof a & {id: string}>('test')
  const a = {prop: 10, propB: 5}
  const b = {prop: 20, propB: 5}
  db.insertAll(Test, [a, b])
  type Input = {prop: number}
  const byProp = query(({prop}: Input) => Test.where(Test.prop.is(prop)))
  assert.is(db.first(byProp({prop: 10}))!.prop, 10)
  assert.is(db.first(byProp({prop: 20}))!.prop, 20)
})*/

test('case', () => {
  const db = store()
  type Test = {id: string} & ({type: 'A'; x: number} | {type: 'B'})
  const Test = new Collection<Test>('test')
  const a = {type: 'A', x: 1} as const
  const b = {type: 'B'} as const
  db.insertAll(Test, [a, b])
  assert.equal(
    db.all(
      Test.select(
        Test.type.case({
          A: Expr.value(1),
          B: Expr.value(2)
        })
      )
    ),
    [1, 2]
  )
})

test('json', () => {
  const db = store()
  const Test = new Collection<typeof a & {id: string}>('test')
  const a = {prop: 10, propB: 5}
  const b = {prop: 20, propB: 5}
  db.insertAll(Test, [a, b])
  const q = Test.where(Test.prop.is(10)).select({
    fieldA: Expr.value(12),
    fieldB: Test.propB
  })
  const res1 = db.first(q)!
  assert.is(res1.fieldA, 12)
  assert.is(res1.fieldB, 5)
})

test('each', () => {
  const db = store()
  const a = {
    refs: [
      {id: 'b', type: 'entry'},
      {id: 'c', type: 'entry'}
    ]
  }
  const Test = new Collection<typeof a & {id: string}>('test')
  db.insertAll(Test, [a])
  const res = db.first(Test.select({refs: Test.refs.each()}))
  assert.equal(res!, a)

  const b = {id: 'b', title: 'Entry B'}
  const c = {id: 'c', title: 'Entry C'}
  const Entry = new Collection<typeof b>('Entry')
  db.insertAll(Entry, [b, c])

  const refs = Test.refs.each()
  const Link = Entry.as('Link')
  const query = Test.select({
    links: refs
      .where(refs.get('type').is('entry'))
      .innerJoin(Link, Link.id.is(refs.get('id')))
      .select({id: Link.id, title: Link.title})
  })
  const res2 = db.first(query)!
  assert.equal(res2.links, [
    {id: 'b', title: 'Entry B'},
    {id: 'c', title: 'Entry C'}
  ])
})

test('custom id', () => {
  const db = store()
  type Entry = {title: string; alinea?: {id: string}}
  const Entry = new Collection<Entry>('test', {
    id: {
      property: 'alinea.id',
      addToRow: (row: any, id: string) => {
        return {...row, alinea: {...row.alinea, id}}
      },
      getFromRow: (row: any) => row.alinea?.id
    }
  })
  const entries = [{title: 'a'}, {title: 'b'}]
  db.insertAll(Entry, entries)
  const withIds = db.all(Entry)
  assert.ok(withIds.every(e => e.alinea!.id))
})

test.run()
