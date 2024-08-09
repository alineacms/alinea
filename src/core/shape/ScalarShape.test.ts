import {ScalarShape} from 'alinea/core/shape/ScalarShape'
import {test} from 'uvu'
import * as assert from 'uvu/assert'
import * as Y from 'yjs'

const ROOT_KEY = '$root'
const FIELD_KEY = '$doc'

const shape = new ScalarShape('field')

const value1 = 'abc'

const value2 = 132

test('apply', () => {
  const doc = new Y.Doc()
  const root = doc.getMap(ROOT_KEY)
  root.set(FIELD_KEY, shape.toY(value1))
  doc.transact(() => {
    shape.applyY(value2, root, FIELD_KEY)
  })
  const pass2 = shape.fromY(root.get(FIELD_KEY))
  assert.equal(pass2, value2)
})

test.run()
