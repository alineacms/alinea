import {test} from 'uvu'
import * as assert from 'uvu/assert'
import {Collection} from '../src/Collection'
import {Cursor} from '../src/Cursor'
import {Expr} from '../src/Expr'
import {store} from './DbSuite'

test('json', () => {
  const db = store()
  const Node = new Collection<{id: string; index: number; empty?: string}>(
    'node'
  )
  const amount = 10
  const objects = Array.from({length: amount}).map((_, i) => ({index: i}))
  assert.is(objects.length, amount)
  const stored = db.insertAll(Node, objects)
  assert.is(db.count(Node), amount)
  const q = Node.where(Node.index.is(1)).select({
    fieldA: Expr.value(12),
    fieldB: Node.index
  })
  const res1 = db.first(q)!
  assert.is(res1.fieldA, 12)
  assert.is(res1.fieldB, 1)
  const res2: typeof res1 = db.first(new Cursor(q.toJSON()))!
  assert.is(res2.fieldA, 12)
  assert.is(res2.fieldB, 1)
})

test.run()
