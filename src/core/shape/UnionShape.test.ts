import {RecordShape} from 'alinea/core/shape/RecordShape'
import {ScalarShape} from 'alinea/core/shape/ScalarShape'
import * as Y from 'alinea/yjs'
import {test} from 'uvu'
import * as assert from 'uvu/assert'
import {UnionShape} from './UnionShape.js'

const ROOT_KEY = '$root'
const FIELD_KEY = '$doc'

const shape = new UnionShape('Blocks', {
  Block1: new RecordShape('Block1', {
    field1: new ScalarShape('field1'),
    blockInner: new RecordShape('Inner block', {
      field3: new ScalarShape('field3'),
      field4: new ScalarShape('field4')
    })
  }),
  Block2: new RecordShape('Block2', {
    field1: new ScalarShape('field1'),
    field5: new ScalarShape('field3'),
    field6: new ScalarShape('field4')
  })
})

const value1 = {
  id: 'unique0',
  type: 'Block1',
  field1: 'a',
  blockInner: {
    field3: 'a',
    field4: 'b',
    nonsense: 123
  }
}

const value2 = {
  id: 'unique1',
  type: 'Block2',
  field1: '1',
  field5: '2',
  field6: undefined
}

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
