import {equals} from '@alinea/dashboard/view/diff/Equals'
import mdiff from 'mdiff'
import {test} from 'uvu'
import * as assert from 'uvu/assert'

const diff: typeof mdiff = (mdiff as any).default || mdiff

test('basic equality', () => {
  assert.ok(equals(1, 1))
})

test('array equality', () => {
  assert.ok(equals([1], [1]))
})

test('object equality', () => {
  assert.ok(equals([{key: 1}], [{key: 1}]))
})

test('nested equality', () => {
  assert.ok(equals([{key: [1]}], [{key: [1]}]))
})

test('array changes', () => {
  const changes = diff(['a', 'x', 'b', 'c'], ['a', 'b', 'c', 'd'])
  console.log(changes.getLcs())
})

test.run()
