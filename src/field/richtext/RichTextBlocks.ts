import {BlockNode, Node, type TextDoc} from '#/core/TextDoc.js'
import type {ReactiveNode} from '#/dashboard/store/Dashboard.js'
import {atom, type Getter} from 'jotai'

export interface ReactiveRichTextBlock {
  id: string
  index: number
  node: ReactiveNode<object>
  typeName: string
}

/** Watches block identity and order without subscribing to nested fields. */
export function richTextBlocksAtom(reactive: ReactiveNode<TextDoc>) {
  return atom(get => {
    const structure = get(reactive.nodes)
    if (!Array.isArray(structure)) return []
    return structure.flatMap((node, index) => {
      const reactiveNode = node as ReactiveNode<object>
      const typeName = childValue(get, reactiveNode, Node.type)
      if (
        typeof typeName !== 'string' ||
        !Node.isBlock({[Node.type]: typeName})
      )
        return []
      return [
        {
          id: String(childValue(get, reactiveNode, BlockNode.id) ?? index),
          index,
          node: reactiveNode,
          typeName
        }
      ]
    })
  })
}

function childValue(
  get: Getter,
  node: ReactiveNode<object>,
  key: string
): unknown {
  const children = get(node.nodes)
  if (!isReactiveObject(children)) return
  const child = children[key]
  return child ? get(child.value) : undefined
}

function isReactiveObject(
  value: unknown
): value is Record<string, ReactiveNode> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
