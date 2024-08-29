import {suite} from '@alinea/suite'
import {equals} from 'alinea/dashboard/view/diff/DiffUtils'

suite(import.meta, test => {
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
})
