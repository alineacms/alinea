import {suite} from '@alinea/suite'
import {equals} from 'alinea/dashboard/view/diff/DiffUtils'

const test = suite(import.meta)

test('basic equality', () => {
  test.ok(equals(1, 1))
})

test('array equality', () => {
  test.ok(equals([1], [1]))
})

test('object equality', () => {
  test.ok(equals([{key: 1}], [{key: 1}]))
})

test('nested equality', () => {
  test.ok(equals([{key: [1]}], [{key: [1]}]))
})
