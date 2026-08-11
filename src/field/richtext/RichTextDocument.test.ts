import {suite} from '@alinea/suite'
import {BlockNode, ElementNode, Mark, Node, TextNode} from '#/core/TextDoc.js'
import {editorContent, editorNodes} from './RichTextDocument.js'

const test = suite(import.meta)

const paragraph = {
  [Node.type]: 'paragraph',
  [ElementNode.content]: [
    {
      [Node.type]: 'text',
      [TextNode.text]: 'Hello',
      [TextNode.marks]: [
        {
          [Mark.type]: 'link',
          _id: 'link-1',
          _anchor: 'details',
          href: '/hello#details'
        }
      ]
    }
  ]
}

const block = {
  [Node.type]: 'Callout',
  [BlockNode.id]: 'block-1',
  title: 'Remember'
}

test('round trips text, element attributes and mark attributes', () => {
  const content = editorContent([
    {...paragraph, textAlign: 'center', empty: undefined}
  ])

  test.equal(content.content?.[0]?.content?.[0]?.marks?.[0]?.attrs, {
    'data-id': 'link-1',
    'data-anchor': 'details',
    href: '/hello#details'
  })
  test.equal(editorNodes(content), [{...paragraph, textAlign: 'center'}])
})

test('stores block identity with a recovery snapshot in ProseMirror', () => {
  const content = editorContent([paragraph, block, paragraph])
  test.equal(content.content?.[1], {
    type: 'Callout',
    attrs: {
      [BlockNode.id]: 'block-1',
      'data-alinea-block': block
    }
  })
  test.equal(
    editorNodes(content, id => (id === 'block-1' ? block : undefined)),
    [paragraph, block, paragraph]
  )
})

test('restores a block from its snapshot when its live node is unavailable', () => {
  const content = editorContent([block])
  test.equal(
    editorNodes(content, () => undefined),
    [block]
  )
})

test('rejects recovery snapshots with a mismatched type or id', () => {
  test.equal(
    editorNodes({
      type: 'doc',
      content: [
        {
          type: 'Callout',
          attrs: {
            [BlockNode.id]: 'block-1',
            'data-alinea-block': {...block, [Node.type]: 'Banner'}
          }
        },
        {
          type: 'Callout',
          attrs: {
            [BlockNode.id]: 'block-2',
            'data-alinea-block': block
          }
        }
      ]
    }),
    [
      {[Node.type]: 'Callout', [BlockNode.id]: 'block-1'},
      {[Node.type]: 'Callout', [BlockNode.id]: 'block-2'}
    ]
  )
})

test('rejects a resolver result for another block', () => {
  const content = editorContent([block])

  test.equal(
    editorNodes(content, () => ({...block, [BlockNode.id]: 'other'})),
    [block]
  )
})

test('drops internal block snapshots and nullish attributes from elements', () => {
  test.equal(
    editorNodes({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: {
            textAlign: 'right',
            empty: null,
            missing: undefined,
            'data-alinea-block': block
          },
          content: [{type: 'text', text: 'Aligned'}]
        },
        {type: 'horizontalRule'}
      ]
    }),
    [
      {
        [Node.type]: 'paragraph',
        textAlign: 'right',
        [ElementNode.content]: [
          {[Node.type]: 'text', [TextNode.text]: 'Aligned'}
        ]
      },
      {[Node.type]: 'horizontalRule'}
    ]
  )
})

test('normalizes the editor empty paragraph to an empty field value', () => {
  test.equal(
    editorNodes({
      type: 'doc',
      content: [{type: 'paragraph', content: []}]
    }),
    []
  )
})
