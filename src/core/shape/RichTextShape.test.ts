import {RecordShape} from 'alinea/core/shape/RecordShape'
import {RichTextShape} from 'alinea/core/shape/RichTextShape'
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
    type: 'Block2',
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

const value3 = [
  {
    type: 'paragraph',
    textAlign: 'left',
    content: [
      {
        type: 'text',
        text: 'text part 1'
      },
      {
        type: 'text',
        text: 'text part 2',
        marks: [
          {
            type: 'link',
            attrs: {
              'data-id': '2WyS6kjRXyd0vLoZP0p129IPnAA',
              'data-entry': '2Ublmf4UWT5rHeIUSaJmqJYN0L9',
              'data-type': null,
              href: null,
              title: ''
            }
          }
        ]
      }
    ]
  }
]

const value4 = [
  {
    type: 'paragraph',
    textAlign: 'left',
    content: [
      {
        type: 'text',
        text: 'text part 1'
      },
      {
        type: 'text',
        text: 'text part 3',
        marks: [
          {
            type: 'link',
            attrs: {
              'data-id': '2WyS6kjRXyd0vLoZP0p129IPnAA',
              'data-entry': '2Ublmf4UWT5rHeIUSaJmqJYN0L9',
              'data-type': null,
              href: null,
              title: ''
            }
          }
        ]
      }
    ]
  }
]

const value5 = [
  {
    type: 'paragraph',
    textAlign: 'left',
    content: [
      {
        type: 'text',
        text: 'text part 1'
      },
      {
        type: 'text',
        text: 'text part 2',
        marks: [
          {
            type: 'link',
            attrs: {
              'data-id': 'xyz',
              'data-entry': '2Ublmf4UWT5rHeIUSaJmqJYN0L9',
              'data-type': null,
              href: null,
              title: ''
            }
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
  const pass1 = shape.fromY(root.get(FIELD_KEY))
  assert.equal(pass1, value1)
})

test('apply over existing', () => {
  const doc = new Y.Doc()
  const root = doc.getMap(ROOT_KEY)
  root.set(FIELD_KEY, shape.toY(value1))
  doc.transact(() => {
    shape.applyY(value2, root, FIELD_KEY)
  })
  const pass2 = shape.fromY(root.get(FIELD_KEY))
  assert.equal(pass2, value2)
})

test.only('update marks', () => {
  const doc = new Y.Doc()
  const root = doc.getMap(ROOT_KEY)
  /*root.set(FIELD_KEY, shape.toY(value3))
  doc.transact(() => {
    shape.applyY(value4, root, FIELD_KEY)
  })
  const pass2 = shape.fromY(root.get(FIELD_KEY))
  assert.equal(pass2, value4)*/

  root.set(FIELD_KEY, shape.toY(value3))
  doc.transact(() => {
    shape.applyY(value5, root, FIELD_KEY)
  })
  const pass3 = shape.fromY(root.get(FIELD_KEY))
  assert.equal(pass3, value5)
})

test.run()
