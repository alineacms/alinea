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
  const stored = db.insertAll(Node, objects)
  assert.equal(db.count(Node), amount)
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
  const res = db.all(Test.select({a: Test.propA, b: Test.propB}))
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
  type Test = {id: string; type: 'A' | 'B'}
  const Test = new Collection<Test>('test')
  const a = {type: 'A'} as const
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

test.run()
