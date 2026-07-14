import {
  BlockNode,
  ElementNode,
  Mark,
  Node,
  TextNode,
  type TextDoc
} from '#/core/TextDoc.js'
import type {JSONContent} from '@tiptap/core'

export function editorContent(nodes: TextDoc): JSONContent {
  return {
    type: 'doc',
    content: nodes.map(nodeToContent)
  }
}

export function editorNodes(
  content: JSONContent,
  resolveBlock?: (id: string, typeName: string) => BlockNode | undefined
): TextDoc {
  const nodes =
    content.content?.flatMap(node => contentToNodes(node, resolveBlock)) ?? []
  return isEmptyDocument(nodes) ? [] : nodes
}

function nodeToContent(node: Node): JSONContent {
  if (isBlock(node)) {
    return {
      type: node[Node.type],
      attrs: {[BlockNode.id]: node[BlockNode.id]}
    }
  }
  if (isText(node)) {
    return {
      type: 'text',
      text: node[TextNode.text],
      marks: node[TextNode.marks]?.map(markToContent)
    }
  }
  if (isElement(node)) {
    const {[Node.type]: type, [ElementNode.content]: content, ...attrs} = node
    return {
      type,
      attrs: withoutNullish(attrs),
      content: content?.map(nodeToContent)
    }
  }
  throw new TypeError(
    'Embedded blocks cannot be placed inside an editor segment'
  )
}

function contentToNodes(
  content: JSONContent,
  resolveBlock?: (id: string, typeName: string) => BlockNode | undefined
): TextDoc {
  const {type, text, marks, attrs} = content
  if (!type) return []
  if (Node.isBlock({[Node.type]: type})) {
    const id = String(attrs?.[BlockNode.id] ?? '')
    const block = resolveBlock?.(id, type)
    return block
      ? [block]
      : [{[Node.type]: type, [BlockNode.id]: id} as BlockNode]
  }
  if (type === 'text') {
    const node: TextNode = {
      [Node.type]: 'text',
      [TextNode.text]: text
    }
    if (marks?.length) node[TextNode.marks] = marks.map(contentToMark)
    return [node]
  }
  return [
    {
      [Node.type]: type,
      ...withoutNullish(attrs),
      [ElementNode.content]: content.content?.flatMap(node =>
        contentToNodes(node, resolveBlock)
      )
    }
  ]
}

function markToContent(mark: Mark): NonNullable<JSONContent['marks']>[number] {
  const {[Mark.type]: type, ...attributes} = mark
  return {
    type,
    attrs: Object.fromEntries(
      Object.entries(attributes).map(([key, value]) => [
        key.startsWith('_') ? `data-${key.slice(1)}` : key,
        value
      ])
    )
  }
}

function contentToMark(content: JSONContent): Mark {
  const attributes = Object.fromEntries(
    Object.entries(content.attrs ?? {})
      .filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string'
      )
      .map(([key, value]) => [
        key.startsWith('data-') ? `_${key.slice(5)}` : key,
        value
      ])
  )
  return {[Mark.type]: content.type ?? '', ...attributes}
}

function withoutNullish(
  attributes: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!attributes) return
  const result = Object.fromEntries(
    Object.entries(attributes).filter(([, value]) => value != null)
  )
  return Object.keys(result).length ? result : undefined
}

function isEmptyDocument(nodes: TextDoc): boolean {
  if (nodes.length !== 1) return false
  const [node] = nodes
  return (
    isElement(node) &&
    node[Node.type] === 'paragraph' &&
    (node[ElementNode.content]?.length ?? 0) === 0
  )
}

function isText(value: unknown): value is TextNode {
  return isRecord(value) && Node.isText(value)
}

function isElement(value: unknown): value is ElementNode {
  return isRecord(value) && Node.isElement(value)
}

function isBlock(value: unknown): value is BlockNode {
  return isRecord(value) && Node.isBlock(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
