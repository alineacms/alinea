import {suite} from '@alinea/suite'
import {BlockNode, ElementNode, Mark, Node, TextNode} from '#/core/TextDoc.js'
import type {JSONContent} from '@tiptap/react'
import {
  createRichTextBlockCache,
  richTextBlockAttribute
} from './RichTextBlockCodec.js'
import {cacheRichTextBlocks, fromContent, toContent} from './RichTextContent.js'

const test = suite(import.meta)

const block = {
  [Node.type]: 'Callout',
  [BlockNode.id]: 'block-1',
  title: 'Remember',
  body: {
    text: 'Inline block content'
  }
}

const staleBlock = {
  [Node.type]: 'Callout',
  [BlockNode.id]: 'block-1',
  title: 'Old title'
}

test('serializes full block data into TipTap attrs', () => {
  const content = toContent(block)

  test.equal(content, {
    type: 'Callout',
    attrs: {
      [BlockNode.id]: 'block-1',
      [richTextBlockAttribute]: block
    }
  })
})

test('serializes text marks and converts private attrs to data attrs', () => {
  const content = toContent({
    [Node.type]: 'text',
    [TextNode.text]: 'Linked text',
    [TextNode.marks]: [
      {
        [Mark.type]: 'link',
        _id: 'link-1',
        _entry: 'entry-1',
        title: 'Link title'
      }
    ]
  })

  test.equal(content, {
    type: 'text',
    text: 'Linked text',
    marks: [
      {
        type: 'link',
        attrs: {
          'data-id': 'link-1',
          'data-entry': 'entry-1',
          title: 'Link title'
        }
      }
    ]
  })
})

test('serializes element attrs and nested content', () => {
  const content = toContent({
    [Node.type]: 'paragraph',
    textAlign: 'center',
    [ElementNode.content]: [
      {
        [Node.type]: 'text',
        [TextNode.text]: 'Centered'
      }
    ]
  })

  test.equal(content, {
    type: 'paragraph',
    attrs: {
      textAlign: 'center'
    },
    content: [
      {
        type: 'text',
        text: 'Centered',
        marks: undefined
      }
    ]
  })
})

test('decodes full block data from TipTap attrs', () => {
  const content = {
    type: 'doc',
    content: [toContent(block)]
  } satisfies JSONContent

  test.equal(fromContent(content, [], createRichTextBlockCache()), [block])
})

test('decodes full block data from serialized HTML attr strings', () => {
  const content = {
    type: 'doc',
    content: [
      {
        type: 'Callout',
        attrs: {
          [richTextBlockAttribute]: JSON.stringify(block)
        }
      }
    ]
  } satisfies JSONContent

  test.equal(fromContent(content, [], createRichTextBlockCache()), [block])
})

test('decodes text marks and converts data attrs to private attrs', () => {
  const content = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Linked text',
            marks: [
              {
                type: 'link',
                attrs: {
                  'data-id': 'link-1',
                  'data-entry': 'entry-1',
                  title: 'Link title',
                  count: 1
                }
              }
            ]
          }
        ]
      }
    ]
  } satisfies JSONContent

  test.equal(fromContent(content, [], createRichTextBlockCache()), [
    {
      [Node.type]: 'paragraph',
      [ElementNode.content]: [
        {
          [Node.type]: 'text',
          [TextNode.text]: 'Linked text',
          [TextNode.marks]: [
            {
              [Mark.type]: 'link',
              _id: 'link-1',
              _entry: 'entry-1',
              title: 'Link title'
            }
          ]
        }
      ]
    }
  ])
})

test('drops nullish element attrs and internal serialized block attrs', () => {
  const content = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        attrs: {
          textAlign: 'right',
          empty: null,
          missing: undefined,
          [richTextBlockAttribute]: staleBlock
        },
        content: [
          {
            type: 'text',
            text: 'Aligned'
          }
        ]
      }
    ]
  } satisfies JSONContent

  test.equal(fromContent(content, [], createRichTextBlockCache()), [
    {
      [Node.type]: 'paragraph',
      textAlign: 'right',
      [ElementNode.content]: [
        {
          [Node.type]: 'text',
          [TextNode.text]: 'Aligned'
        }
      ]
    }
  ])
})

test('returns an empty value for empty editor paragraphs', () => {
  const content = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: []
      }
    ]
  } satisfies JSONContent

  test.equal(fromContent(content, [], createRichTextBlockCache()), [])
})

test('falls back to a minimal block when data cannot be decoded', () => {
  const content = {
    type: 'doc',
    content: [
      {
        type: 'Callout',
        attrs: {
          [BlockNode.id]: 'block-1',
          [richTextBlockAttribute]: '{'
        }
      }
    ]
  } satisfies JSONContent

  test.equal(fromContent(content, [], createRichTextBlockCache()), [
    {
      [Node.type]: 'Callout',
      [BlockNode.id]: 'block-1'
    }
  ])
})

test('prefers explicit serialized block data over cached data', () => {
  const cache = createRichTextBlockCache()
  cache.set(block[BlockNode.id], staleBlock)
  const content = {
    type: 'doc',
    content: [toContent(block)]
  } satisfies JSONContent

  test.equal(fromContent(content, [], cache), [block])
})

test('rehydrates restored block ids from the block cache', () => {
  const cache = createRichTextBlockCache()
  const deletedContent = {
    type: 'doc',
    content: []
  } satisfies JSONContent

  fromContent(deletedContent, [block], cache)

  const restoredContent = {
    type: 'doc',
    content: [
      {
        type: 'Callout',
        attrs: {
          [BlockNode.id]: 'block-1'
        }
      }
    ]
  } satisfies JSONContent

  test.equal(fromContent(restoredContent, [], cache), [block])
})

test('caches block data found in nested content', () => {
  const cache = createRichTextBlockCache()

  cacheRichTextBlocks(
    [
      {
        [Node.type]: 'paragraph',
        [ElementNode.content]: [block]
      }
    ],
    cache
  )

  test.equal(cache.get(block[BlockNode.id]), block)
})
