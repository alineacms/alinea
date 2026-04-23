import {suite} from '@alinea/suite'
import {insertIndex} from './ListField.view.js'

const test = suite(import.meta)

test('insertIndex maps row separators to array insertion indexes', () => {
  test.equal(insertIndex(0, 'before'), 0)
  test.equal(insertIndex(0, 'after'), 1)
  test.equal(insertIndex(3, 'before'), 3)
  test.equal(insertIndex(3, 'after'), 4)
})

