import {BlockNode, ElementNode, Mark, Node, TextNode} from '#/core/TextDoc.js'
import {entries, fromEntries} from '#/core/util/Objects.js'
import type {JSONContent} from '@tiptap/react'
import {
  decodeRichTextBlock,
  richTextBlockAttribute,
  richTextBlockAttributes,
  richTextSessionBlockCache,
  type RichTextBlockCache
} from './RichTextBlockCodec.js'

export function toContent(node: Node): JSONContent {
  if (isTextNode(node))
    return {
      type: 'text',
      text: node[TextNode.text],
      marks: node[TextNode.marks]?.map(mark => {
        const {[Mark.type]: type, ...attrs} = mark
        const res = Object.fromEntries(
          entries(attrs).map(([key, value]) => {
            if (key.startsWith('_')) return [`data-${key.slice(1)}`, value]
            return [key, value]
          })
        )
        return {type, attrs: res}
      })
    }
  if (isElementNode(node)) {
    const {[Node.type]: type, [ElementNode.content]: content, ...attrs} = node
    return {type, content: content?.map(toContent), attrs}
  }
  if (isBlockNode(node)) {
    const {[Node.type]: type} = node
    return {type, attrs: richTextBlockAttributes(node)}
  }
  throw new TypeError('Invalid node')
}

export function fromContent(
  content: JSONContent,
  currentValue: Array<Node> = [],
  blockCache: RichTextBlockCache = richTextSessionBlockCache
): Array<Node> {
  cacheRichTextBlocks(currentValue, blockCache)
  const blocksById = new Map<string, BlockNode>(blockCache)
  for (const block of findRichTextBlocks(currentValue)) {
    blocksById.set(String(block[BlockNode.id]), block)
  }
  const nodes =
    content.content?.flatMap(node => fromNode(node, blocksById)) ?? []
  cacheRichTextBlocks(nodes, blockCache)
  const [first] = nodes
  const isEmptyParagraph =
    nodes.length === 1 &&
    isElementNode(first) &&
    first[Node.type] === 'paragraph' &&
    first[ElementNode.content]?.length === 0
  return isEmptyParagraph ? [] : nodes
}

export function cacheRichTextBlocks(
  value: Array<Node>,
  blockCache: RichTextBlockCache = richTextSessionBlockCache
) {
  for (const block of findRichTextBlocks(value)) {
    blockCache.set(String(block[BlockNode.id]), block)
  }
}

function findRichTextBlocks(value: Array<Node>): Array<BlockNode> {
  return value.flatMap(node => {
    if (isBlockNode(node)) return [node]
    if (isElementNode(node) && node[ElementNode.content])
      return findRichTextBlocks(node[ElementNode.content])
    return []
  })
}

function fromNode(
  content: JSONContent,
  blocksById: Map<string, BlockNode>
): Array<Node> {
  const {type, text, marks, attrs} = content
  if (!type) return []
  if (type === 'text') {
    const node: Node = {
      [Node.type]: 'text',
      [TextNode.text]: text,
      [TextNode.marks]: marks?.map(fromMark)
    }
    if (!node[TextNode.marks]?.length) delete node[TextNode.marks]
    return [node]
  }
  if (type[0] === type[0].toUpperCase()) {
    const serializedBlock = decodeRichTextBlock(attrs?.[richTextBlockAttribute])
    const id = String(
      attrs?.[BlockNode.id] ?? serializedBlock?.[BlockNode.id] ?? ''
    )
    if (serializedBlock && serializedBlock[Node.type] === type) {
      return [serializedBlock]
    }
    const cachedBlock = blocksById.get(id)
    if (cachedBlock) return [cachedBlock]
    return [
      {
        [Node.type]: type,
        [BlockNode.id]: id
      }
    ]
  }
  const normalizedAttrs = normalizeNodeAttrs(attrs)
  return [
    {
      [Node.type]: type,
      ...normalizedAttrs,
      [ElementNode.content]: content.content?.flatMap(node =>
        fromNode(node, blocksById)
      )
    }
  ]
}

function fromMark(mark: NonNullable<JSONContent['marks']>[number]): Mark {
  const {type, attrs} = mark
  return {
    [Mark.type]: type,
    ...Object.fromEntries(
      entries(normalizeMarkAttrs(attrs)).map(([key, value]) => {
        if (key.startsWith('data-')) return [`_${key.slice(5)}`, value]
        return [key, value]
      })
    )
  }
}

function normalizeNodeAttrs(
  attrs: Record<string, unknown> | undefined
): Record<string, unknown> {
  return Object.fromEntries(
    entries(attrs ?? {}).filter(
      ([key, value]) =>
        key !== richTextBlockAttribute && value !== null && value !== undefined
    )
  )
}

function normalizeMarkAttrs(attrs: Record<string, unknown> | undefined) {
  return fromEntries(
    entries(attrs ?? {}).filter(([, value]) => typeof value === 'string')
  ) as Record<string, string>
}

function isTextNode(value: unknown): value is TextNode {
  return isRecord(value) && Node.isText(value)
}

function isElementNode(value: unknown): value is ElementNode {
  return isRecord(value) && Node.isElement(value)
}

function isBlockNode(value: unknown): value is BlockNode {
  return isRecord(value) && Node.isBlock(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
