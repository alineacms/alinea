import {BlockNode, Node, type TextDoc} from '#/core/TextDoc.js'
import {isRecord} from '#/core/util/Objects.js'
import type {ReactiveNode} from '#/dashboard/store/Dashboard.js'
import {atom, type Getter} from 'jotai'

export interface ReactiveRichTextBlock {
  id: string
  index: number
  node: ReactiveNode<object>
  typeName: string
}

export interface RichTextStructure {
  blocks: Array<ReactiveRichTextBlock>
  structure: TextDoc
}

/** Watches block identity and order without subscribing to nested fields. */
export function richTextBlocksAtom(reactive: ReactiveNode<TextDoc>) {
  const structure = richTextStructureAtom(reactive)
  return atom(get => get(structure).blocks)
}

/** Watches ordinary content plus block identity, but not block field values. */
export function richTextStructureAtom(reactive: ReactiveNode<TextDoc>) {
  return atom<RichTextStructure>(get => {
    const nodes = get(reactive.nodes)
    if (!Array.isArray(nodes)) return {blocks: [], structure: []}
    const blocks: Array<ReactiveRichTextBlock> = []
    const structure: TextDoc = []
    nodes.forEach((node, index) => {
      const reactiveNode = node as ReactiveNode<object>
      const typeName = childValue(get, reactiveNode, Node.type)
      if (
        typeof typeName === 'string' &&
        Node.isBlock({[Node.type]: typeName})
      ) {
        const id = String(childValue(get, reactiveNode, BlockNode.id) ?? index)
        blocks.push({id, index, node: reactiveNode, typeName})
        structure.push({[Node.type]: typeName, [BlockNode.id]: id})
      } else structure.push(get(reactiveNode.value) as TextDoc[number])
    })
    return {blocks, structure}
  })
}

function childValue(
  get: Getter,
  node: ReactiveNode<object>,
  key: string
): unknown {
  const children = get(node.nodes)
  if (!isRecord(children)) return
  const child = children[key] as ReactiveNode | undefined
  return child ? get(child.value) : undefined
}
