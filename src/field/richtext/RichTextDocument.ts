import {
  BlockNode,
  ElementNode,
  Mark,
  Node,
  TextNode,
  type TextDoc
} from '#/core/TextDoc.js'
import type {JSONContent} from '@tiptap/core'
import {
  blockAttributes,
  decodeBlockValue,
  richTextBlockValueAttribute
} from './RichTextBlockValue.js'
import {isRecord} from '#/core/util/Objects.js'

export function editorContent(nodes: TextDoc): JSONContent {
  return {
    type: 'doc',
    content: nodes.map(nodeToContent)
  }
}

export function editorNodes(
  content: JSONContent,
  resolveBlock?: (
    id: string,
    typeName: string,
    snapshot: BlockNode | undefined
  ) => BlockNode | undefined
): TextDoc {
  const nodes =
    content.content?.flatMap(node => contentToNodes(node, resolveBlock)) ?? []
  return isEmptyDocument(nodes) ? [] : nodes
}

function nodeToContent(node: Node): JSONContent {
  if (isBlock(node)) {
    return {
      type: node[Node.type],
      attrs: blockAttributes(node)
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
    let editorContent = content
    // Tiptap requires list items to contain paragraphs, so normalize imported
    // inline content before passing it to the editor.
    if (type === 'listItem' && content?.some(isText)) {
      const normalized: TextDoc = []
      editorContent = normalized
      let inline: TextDoc = []
      function flushInline() {
        if (!inline.length) return
        normalized.push({
          [Node.type]: 'paragraph',
          [ElementNode.content]: inline
        })
        inline = []
      }
      for (const child of content) {
        if (isText(child)) {
          inline.push(child)
        } else {
          flushInline()
          normalized.push(child)
        }
      }
      flushInline()
    }
    return {
      type,
      attrs: withoutNullish(attrs),
      content: editorContent?.map(nodeToContent)
    }
  }
  throw new TypeError(
    'Embedded blocks cannot be placed inside an editor segment'
  )
}

function contentToNodes(
  content: JSONContent,
  resolveBlock?: (
    id: string,
    typeName: string,
    snapshot: BlockNode | undefined
  ) => BlockNode | undefined
): TextDoc {
  const {type, text, marks, attrs} = content
  if (!type) return []
  if (Node.isBlock({[Node.type]: type})) {
    const decodedSnapshot = decodeBlockValue(
      attrs?.[richTextBlockValueAttribute]
    )
    const id = String(
      attrs?.[BlockNode.id] ?? decodedSnapshot?.[BlockNode.id] ?? ''
    )
    const snapshot = isMatchingBlock(decodedSnapshot, id, type)
      ? decodedSnapshot
      : undefined
    const resolved = resolveBlock?.(id, type, snapshot)
    const block = isMatchingBlock(resolved, id, type) ? resolved : snapshot
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
  const {[richTextBlockValueAttribute]: _blockSnapshot, ...elementAttributes} =
    attrs ?? {}
  const children = content.content?.flatMap(node =>
    contentToNodes(node, resolveBlock)
  )
  return [
    {
      [Node.type]: type,
      ...withoutNullish(elementAttributes),
      ...(children === undefined ? {} : {[ElementNode.content]: children})
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

function isMatchingBlock(
  value: unknown,
  id: string,
  typeName: string
): value is BlockNode {
  return (
    isBlock(value) &&
    value[Node.type] === typeName &&
    typeof value[BlockNode.id] === 'string' &&
    value[BlockNode.id] === id
  )
}
