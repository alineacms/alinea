import {equals} from 'alinea/dashboard/view/diff/DiffUtils'
import {test} from 'uvu'
import * as assert from 'uvu/assert'

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

test.run()
