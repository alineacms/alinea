import {ScalarShape} from '@alinea/core/shape/ScalarShape'
import {test} from 'uvu'
import * as assert from 'uvu/assert'
import * as Y from 'yjs'
import {RichTextShape} from '../src'
import {RecordShape} from '../src/shape/RecordShape'

test('serialize', () => {
  const type = new RichTextShape('RichText', {
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
