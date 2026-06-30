import {BlockNode, Node} from '#/core/TextDoc.js'

export const richTextBlockAttribute = 'data-alinea-block'

export interface RichTextSerializedBlock extends BlockNode {
  [key: string]: unknown
}

export interface RichTextBlockCache extends Map<string, BlockNode> {}

export function createRichTextBlockCache(): RichTextBlockCache {
  return new Map<string, BlockNode>()
}

export const richTextSessionBlockCache = createRichTextBlockCache()

export function isRichTextSerializedBlock(
  value: unknown
): value is RichTextSerializedBlock {
  if (!isRecord(value)) return false
  return (
    Node.isBlock(value) &&
    typeof value[BlockNode.id] === 'string' &&
    typeof value[Node.type] === 'string'
  )
}

export function encodeRichTextBlock(value: unknown): string | undefined {
  if (!isRichTextSerializedBlock(value)) return
  return JSON.stringify(value)
}

export function decodeRichTextBlock(
  value: unknown
): RichTextSerializedBlock | undefined {
  if (isRichTextSerializedBlock(value)) return value
  if (typeof value !== 'string' || value.trim() === '') return
  try {
    const parsed = JSON.parse(value) as unknown
    if (isRichTextSerializedBlock(parsed)) return parsed
  } catch {
    return
  }
}

export function richTextBlockAttributes(
  block: BlockNode
): Record<string, unknown> {
  return {
    [BlockNode.id]: block[BlockNode.id],
    [richTextBlockAttribute]: block
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
