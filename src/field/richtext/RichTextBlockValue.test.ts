import {suite} from '@alinea/suite'
import {BlockNode, Node} from '#/core/TextDoc.js'
import {
  blockAttributes,
  decodeBlockValue,
  encodeBlockValue,
  richTextBlockValueAttribute
} from './RichTextBlockValue.js'

const test = suite(import.meta)

const block = {
  [Node.type]: 'Callout',
  [BlockNode.id]: 'block-1',
  title: 'Remember'
}

test('encodes, decodes and attributes valid block values', () => {
  test.equal(decodeBlockValue(encodeBlockValue(block)), block)
  test.equal(decodeBlockValue(block), block)
  test.equal(blockAttributes(block), {
    [BlockNode.id]: 'block-1',
    [richTextBlockValueAttribute]: block
  })
})

test('rejects malformed and non-block values', () => {
  test.is(decodeBlockValue('{'), undefined)
  test.is(decodeBlockValue(''), undefined)
  test.is(decodeBlockValue('   '), undefined)
  test.is(
    decodeBlockValue(JSON.stringify({_type: 'paragraph', _id: 'x'})),
    undefined
  )
  test.is(decodeBlockValue({_type: 'Callout', _id: 1}), undefined)
  test.is(encodeBlockValue({_type: 'Callout'}), undefined)
  test.is(encodeBlockValue(null), undefined)
})
