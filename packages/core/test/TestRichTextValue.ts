import {ScalarValue} from '@alinea/core/value/ScalarValue'
import {test} from 'uvu'
import * as assert from 'uvu/assert'
import * as Y from 'yjs'
import {RichTextValue} from '../src'
import {RecordValue} from '../src/value/RecordValue'

test('serialize', () => {
  const type = new RichTextValue('RichText', {
    Block1: new RecordValue('Block1', {
      field1: new ScalarValue('field1'),
      blockInner: new RecordValue('Inner block', {
        field3: new ScalarValue('field3'),
        field4: new ScalarValue('field4')
      })
    }),
    Block2: new RecordValue('Block2', {
      field3: new ScalarValue('field3'),
      field4: new ScalarValue('field4')
    })
  })

  const value = [
    {
      type: 'paragraph',
      content: [{type: 'text', text: 'Hello'}]
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
  const yType = type.toY(value)
  // Changes are not reflected in Y types until mounted in a Y.Doc
  const doc = new Y.Doc()
  doc.getMap('root').set('$doc', yType)
  const pass2 = type.fromY(yType)
  assert.equal(pass2, value)
})

test.run()
