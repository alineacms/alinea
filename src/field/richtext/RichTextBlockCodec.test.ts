import {suite} from '@alinea/suite'
import {BlockNode, Node} from '#/core/TextDoc.js'
import {
  createRichTextBlockCache,
  decodeRichTextBlock,
  encodeRichTextBlock,
  isRichTextSerializedBlock,
  richTextBlockAttribute,
  richTextBlockAttributes
} from './RichTextBlockCodec.js'

const test = suite(import.meta)

const block = {
  [Node.type]: 'Callout',
  [BlockNode.id]: 'block-1',
  title: 'Remember',
  body: {
    text: 'Inline block content'
  }
}

test('encodes and decodes rich text block data', () => {
  const encoded = encodeRichTextBlock(block)

  test.is(typeof encoded, 'string')
  test.equal(decodeRichTextBlock(encoded), block)
})

test('accepts already decoded block data', () => {
  test.equal(decodeRichTextBlock(block), block)
})

test('creates block attributes for TipTap and HTML serialization', () => {
  test.equal(richTextBlockAttributes(block), {
    [BlockNode.id]: 'block-1',
    [richTextBlockAttribute]: block
  })
})

test('creates isolated caches', () => {
  const first = createRichTextBlockCache()
  const second = createRichTextBlockCache()

  first.set(block[BlockNode.id], block)

  test.equal(first.get(block[BlockNode.id]), block)
  test.is(second.get(block[BlockNode.id]), undefined)
})

test('accepts valid block shapes only', () => {
  test.is(isRichTextSerializedBlock(block), true)
  test.is(
    isRichTextSerializedBlock({_type: 'paragraph', _id: 'block-1'}),
    false
  )
  test.is(isRichTextSerializedBlock({_type: 'Callout', _id: 1}), false)
  test.is(isRichTextSerializedBlock({_type: 1, _id: 'block-1'}), false)
  test.is(isRichTextSerializedBlock(null), false)
  test.is(isRichTextSerializedBlock([]), false)
})

test('rejects invalid block data', () => {
  test.is(decodeRichTextBlock('{'), undefined)
  test.is(decodeRichTextBlock(''), undefined)
  test.is(decodeRichTextBlock('   '), undefined)
  test.is(decodeRichTextBlock(JSON.stringify({_type: 'paragraph'})), undefined)
  test.is(encodeRichTextBlock({_type: 'Callout'}), undefined)
})
