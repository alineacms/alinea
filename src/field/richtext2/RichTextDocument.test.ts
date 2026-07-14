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
      [TextNode.marks]: [{[Mark.type]: 'link', _id: 'link-1', href: '/hello'}]
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

  test.equal(editorNodes(content), [{...paragraph, textAlign: 'center'}])
})

test('stores only block identity in ProseMirror', () => {
  const content = editorContent([paragraph, block, paragraph])
  test.equal(content.content?.[1], {
    type: 'Callout',
    attrs: {[BlockNode.id]: 'block-1'}
  })
  test.equal(
    editorNodes(content, id => (id === 'block-1' ? block : undefined)),
    [paragraph, block, paragraph]
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
