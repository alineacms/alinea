import {suite} from '@alinea/suite'
import {RecordShape} from 'alinea/core/shape/RecordShape'
import {ScalarShape} from 'alinea/core/shape/ScalarShape'
import * as Y from 'yjs'

const ROOT_KEY = '$root'
const FIELD_KEY = '$doc'

const shape = new RecordShape('Block1', {
  field1: new ScalarShape('field1'),
  blockInner: new RecordShape('Inner block', {
    field3: new ScalarShape('field3'),
    field4: new ScalarShape('field4')
  })
})

const value1 = {
  field1: 'a',
  blockInner: {
    field3: 'a',
    field4: 'b',
    nonsense: 123
  }
}

const value2 = {
  field1: '1',
  blockInner: {
    field3: '2',
    field4: undefined
  }
}

suite(import.meta, test => {
  test('apply', () => {
    const doc = new Y.Doc()
    const root = doc.getMap(ROOT_KEY)
    root.set(FIELD_KEY, shape.toY(value1))
    doc.transact(() => {
      shape.applyY(value2, root, FIELD_KEY)
    })
    const pass2 = shape.fromY(root.get(FIELD_KEY) as Y.Map<any>)
    test.equal(pass2, value2)
  })
})
