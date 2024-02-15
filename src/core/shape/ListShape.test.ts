import {ListShape} from 'alinea/core/shape/ListShape'
import {RecordShape} from 'alinea/core/shape/RecordShape'
import {ScalarShape} from 'alinea/core/shape/ScalarShape'
import * as Y from 'alinea/yjs'
import {test} from 'uvu'
import * as assert from 'uvu/assert'

const ROOT_KEY = '$root'
const FIELD_KEY = '$doc'

const shape = new ListShape('List', {
  Block1: new RecordShape('Block1', {
    field1: new ScalarShape('field1'),
    blockInner: new RecordShape('Inner block', {
      field3: new ScalarShape('field3'),
      field4: new ScalarShape('field4')
    })
  }),
  Block2: new RecordShape('Block2', {
    field3: new ScalarShape('field3'),
    field4: new ScalarShape('field4')
  })
})

const value1 = [
  {
    _id: 'unique0',
    _type: 'Block1',
    _index: 'a0',
    field1: 'a',
    blockInner: {
      field3: 'a',
      field4: 'b'
    }
  },
  {
    _id: 'unique1',
    _type: 'Block1',
    _index: 'a0',
    field1: 'a',
    blockInner: {
      field3: 'a',
      field4: 'b'
    }
  },
  {
    _id: 'unique2',
    _type: 'Block2',
    _index: 'a1',
    field3: 'a',
    field4: 'b'
  }
]

const value2 = [
  {
    _id: 'unique1',
    _type: 'Block1',
    _index: 'a0',
    field1: '00',
    blockInner: {
      field3: 'a',
      field4: 'c'
    }
  },
  {
    _id: 'unique3',
    _type: 'Block1',
    _index: 'a1',
    field1: 'a',
    blockInner: {
      field3: 'a',
      field4: 'b'
    }
  },
  {
    _id: 'unique2',
    _type: 'Block2',
    _index: 'a2',
    field3: 'a11',
    field4: 'b'
  }
]

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

test('normalize', () => {
  const oldValue = [
    {
      id: 'unique1',
      type: 'Block1',
      index: 'a0',
      field1: '00',
      blockInner: {
        field3: 'a',
        field4: 'c'
      }
    }
  ]
  const pass = shape.normalize(oldValue)
  assert.equal(pass, [
    {
      _id: 'unique1',
      _type: 'Block1',
      _index: 'a0',
      field1: '00',
      blockInner: {
        field3: 'a',
        field4: 'c'
      }
    }
  ])
})

test.run()
