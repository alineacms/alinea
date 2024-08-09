import {RecordShape} from 'alinea/core/shape/RecordShape'
import {RichTextShape} from 'alinea/core/shape/RichTextShape'
import {ScalarShape} from 'alinea/core/shape/ScalarShape'
import {test} from 'uvu'
import * as assert from 'uvu/assert'
import * as Y from 'yjs'
import {BlockNode, Node} from '../TextDoc.js'

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
    [Node.type]: 'paragraph',
    content: [{[Node.type]: 'text', text: 'Hello'}]
  },
  {
    [Node.type]: 'Block2',
    [BlockNode.id]: 'unique0',
    field3: 'a',
    field4: 'b'
  },
  {
    [Node.type]: 'Block1',
    [BlockNode.id]: 'unique1',
    field1: 'a',
    blockInner: {
      field3: 'a',
      field4: 'b'
    }
  },
  {
    [Node.type]: 'paragraph',
    content: [{[Node.type]: 'text', text: 'Hello'}]
  },
  {
    [Node.type]: 'Block2',
    [BlockNode.id]: 'unique2',
    field3: 'a',
    field4: 'b'
  }
]

const value2 = [
  {
    [Node.type]: 'paragraph',
    content: [{[Node.type]: 'text', text: 'Hello 123'}]
  },
  {
    [Node.type]: 'paragraph',
    content: [{[Node.type]: 'text', text: 'Hello'}]
  },
  {
    [Node.type]: 'Block1',
    [BlockNode.id]: 'unique1',
    field1: '1',
    blockInner: {
      field3: 'a',
      field4: 'c'
    }
  },
  {
    [Node.type]: 'Block2',
    [BlockNode.id]: 'unique2',
    field3: 'a',
    field4: 'b'
  },
  {
    [Node.type]: 'Block2',
    [BlockNode.id]: 'unique3',
    field3: 'abc',
    field4: 'def'
  }
]

const value3 = [
  {
    [Node.type]: 'paragraph',
    textAlign: 'left',
    content: [
      {
        [Node.type]: 'text',
        text: 'text part 1'
      },
      {
        [Node.type]: 'text',
        text: 'text part 2',
        marks: [
          {
            [Node.type]: 'link',
            _id: '2WyS6kjRXyd0vLoZP0p129IPnAA',
            _entry: '2Ublmf4UWT5rHeIUSaJmqJYN0L9',
            title: ''
          }
        ]
      }
    ]
  }
]

const value4 = [
  {
    [Node.type]: 'paragraph',
    textAlign: 'left',
    content: [
      {
        [Node.type]: 'text',
        text: 'text part 1'
      },
      {
        [Node.type]: 'text',
        text: 'text part 3',
        marks: [
          {
            [Node.type]: 'link',
            _id: '2WyS6kjRXyd0vLoZP0p129IPnAA',
            _entry: '2Ublmf4UWT5rHeIUSaJmqJYN0L9',
            title: ''
          }
        ]
      }
    ]
  }
]

const value5 = [
  {
    [Node.type]: 'paragraph',
    textAlign: 'left',
    content: [
      {
        [Node.type]: 'text',
        text: 'text part 1'
      },
      {
        [Node.type]: 'text',
        text: 'text part 2',
        marks: [
          {
            [Node.type]: 'link',
            _id: 'xyz',
            _entry: '2Ublmf4UWT5rHeIUSaJmqJYN0L9',
            title: ''
          }
        ]
      }
    ]
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

test('apply over empty', () => {
  const doc = new Y.Doc()
  const root = doc.getMap(ROOT_KEY)
  shape.applyY(value1, root, FIELD_KEY)
  const pass1 = shape.fromY(root.get(FIELD_KEY) as Y.Map<any>)
  assert.equal(pass1, value1)
})

test('apply over existing', () => {
  const doc = new Y.Doc()
  const root = doc.getMap(ROOT_KEY)
  root.set(FIELD_KEY, shape.toY(value1))
  doc.transact(() => {
    shape.applyY(value2, root, FIELD_KEY)
  })
  const pass2 = shape.fromY(root.get(FIELD_KEY) as Y.Map<any>)
  assert.equal(pass2, value2)
})

test('update marks', () => {
  const doc = new Y.Doc()
  const root = doc.getMap(ROOT_KEY)

  root.set(FIELD_KEY, shape.toY(value3))
  doc.transact(() => {
    shape.applyY(value5, root, FIELD_KEY)
  })
  const pass3 = shape.fromY(root.get(FIELD_KEY) as Y.Map<any>)
  assert.equal(pass3, value5)
})

test('normalize', () => {
  const old = [
    {
      type: 'paragraph',
      content: [{type: 'text', text: 'Hello'}]
    },
    {
      type: 'Block2',
      id: 'unique0',
      field3: 'a',
      field4: 'b'
    },
    {
      type: 'Block1',
      id: 'unique1',
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
      type: 'Block2',
      id: 'unique2',
      field3: 'a',
      field4: 'b'
    }
  ]
  const normalized = shape.toV1(old)
  assert.equal(normalized, value1)
})

test.run()
