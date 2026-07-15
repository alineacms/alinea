import {BlockNode, Node} from '#/core/TextDoc.js'

export const richTextBlockValueAttribute = 'data-alinea-block'

export function blockAttributes(block: BlockNode): Record<string, unknown> {
  return {
    [BlockNode.id]: block[BlockNode.id],
    [richTextBlockValueAttribute]: block
  }
}

export function encodeBlockValue(value: unknown): string | undefined {
  return isBlockValue(value) ? JSON.stringify(value) : undefined
}

export function decodeBlockValue(value: unknown): BlockNode | undefined {
  if (isBlockValue(value)) return value
  if (typeof value !== 'string' || value.trim() === '') return
  try {
    const parsed = JSON.parse(value) as unknown
    return isBlockValue(parsed) ? parsed : undefined
  } catch {
    return
  }
}

function isBlockValue(value: unknown): value is BlockNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Node.isBlock(value) &&
    typeof value[BlockNode.id] === 'string'
  )
}
