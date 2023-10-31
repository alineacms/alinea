import {RichTextShape} from 'alinea/core'
import {RecordShape} from 'alinea/core/shape/RecordShape'
import {ScalarShape} from 'alinea/core/shape/ScalarShape'
import * as Y from 'alinea/yjs'
import {test} from 'uvu'
import * as assert from 'uvu/assert'

const ROOT_KEY = '$root'
const FIELD_KEY = '$doc'

const shape = new RichTextShape('RichText', {
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
    type: 'paragraph',
    content: [{type: 'text', text: 'Hello'}]
  },
  {
    id: 'unique0',
    type: 'Block1',
    field3: 'a',
    field4: 'b'
  },
  {
    id: 'unique1',
    type: 'Block1',
    field1: 'a',
    blockInner: {
      field3: 'a',
      field4: 'b'
    }
  },
  {
    type: 'paragraph',
    content: [{type: 'text', text: 'Hello'}]
  },
  {
    id: 'unique2',
    type: 'Block2',
    field3: 'a',
    field4: 'b'
  }
]

const value2 = [
  {
    type: 'paragraph',
    content: [{type: 'text', text: 'Hello 123'}]
  },
  {
    type: 'paragraph',
    content: [{type: 'text', text: 'Hello'}]
  },
  {
    id: 'unique1',
    type: 'Block1',
    field1: '1',
    blockInner: {
      field3: 'a',
      field4: 'c'
    }
  },
  {
    id: 'unique2',
    type: 'Block2',
    field3: 'a',
    field4: 'b'
  },
  {
    id: 'unique3',
    type: 'Block2',
    field3: 'abc',
    field4: 'def'
  }
]

test('serialize', () => {
  // Changes are not reflected in Y types until mounted in a Y.Doc
  const doc = new Y.Doc()
  const yType = shape.toY(value1)
  const root = doc.getMap(ROOT_KEY)
  root.set(FIELD_KEY, yType)
  const pass2 = shape.fromY(yType)
  assert.equal(pass2, value1)
})

test.only('apply', () => {
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
