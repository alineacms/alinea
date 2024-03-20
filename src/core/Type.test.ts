import {Type, type} from 'alinea/core/Type'
import {list, richText, text} from 'alinea/field'
import {test} from 'uvu'
import * as assert from 'uvu/assert'
import {ElementNode, Node, TextNode} from './TextDoc.js'
import {ListRow} from './shape/ListShape.js'

const Test = type('Test', {
  fields: {
    a: text('A'),
    b: text('B', {searchable: true}),
    list: list('List', {
      schema: {
        Sub: type({
          c: text('C'),
          d: text('D', {searchable: true})
        })
      }
    }),
    rich: richText('Rich', {searchable: true})
  }
})

const value = {
  a: 'A',
  b: 'B',
  list: [{[ListRow.type]: 'Sub', [ListRow.id]: '123', c: 'C', d: 'D'}],
  rich: [
    {
      [Node.type]: 'heading',
      [ElementNode.content]: [
        {[Node.type]: 'text', [TextNode.text]: 'Rich text'}
      ]
    },
    {
      [Node.type]: 'paragraph',
      [ElementNode.content]: [
        {[Node.type]: 'text', [TextNode.text]: 'Lorem ipsum'}
      ]
    }
  ]
}

test('Searchable text', () => {
  const text = Type.searchableText(Test, value)
  assert.is(text, 'B D Rich text Lorem ipsum')
})

test.run()
