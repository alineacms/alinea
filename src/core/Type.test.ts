import {suite} from '@alinea/suite'
import {Type, type} from '#/core/Type.js'
import {list, richText, text} from '#/field.js'
import {ElementNode, Mark, Node, TextNode} from './TextDoc.js'
import {ListRow} from './ListRow.js'

const Test = type('Test', {
  fields: {
    a: text('A'),
    b: text('B', {searchable: true}),
    list: list('List', {
      schema: {
        Sub: type('Sub', {
          fields: {
            c: text('C'),
            d: text('D', {searchable: true}),
            body: richText('Body')
          }
        })
      }
    }),
    rich: richText('Rich', {searchable: true})
  }
})

const value = {
  a: 'A',
  b: 'B',
  list: [
    {
      [ListRow.type]: 'Sub',
      [ListRow.id]: '123',
      _anchor: 'block-anchor',
      _label: 'Block anchor',
      c: 'C',
      d: 'D',
      body: [
        {
          [Node.type]: 'heading',
          _anchor: 'nested-heading',
          [ElementNode.content]: [
            {[Node.type]: 'text', [TextNode.text]: 'Nested heading'}
          ]
        }
      ]
    }
  ],
  rich: [
    {
      [Node.type]: 'heading',
      _anchor: 'rich-heading',
      [ElementNode.content]: [
        {
          [Node.type]: 'text',
          [TextNode.text]: 'Rich text',
          [TextNode.marks]: [{[Mark.type]: 'anchor', id: 'rich-heading'}]
        }
      ]
    },
    {
      [Node.type]: 'paragraph',
      [ElementNode.content]: [
        {
          [Node.type]: 'text',
          [TextNode.text]: 'Lorem ipsum',
          [TextNode.marks]: [{[Mark.type]: 'anchor', id: 'inline-anchor'}]
        }
      ]
    }
  ]
}

const test = suite(import.meta)

test('Searchable text', () => {
  const text = Type.searchableText(Test, value)
  test.is(text, 'B D Rich text Lorem ipsum')
})

test('Anchors', () => {
  const anchors = Type.anchors(Test, value)
  test.equal(
    anchors.map(anchor => ({
      id: anchor.id,
      fieldPath: anchor.fieldPath,
      fieldLabel: anchor.fieldLabel
    })),
    [
      {
        id: 'block-anchor',
        fieldPath: 'list.123.block-anchor',
        fieldLabel: 'List'
      },
      {
        id: 'nested-heading',
        fieldPath: 'list.123.body.0.nested-heading',
        fieldLabel: 'Body'
      },
      {
        id: 'rich-heading',
        fieldPath: 'rich.0.rich-heading',
        fieldLabel: 'Rich'
      },
      {
        id: 'inline-anchor',
        fieldPath: 'rich.1.content.0.inline-anchor',
        fieldLabel: 'Rich'
      }
    ]
  )
})
