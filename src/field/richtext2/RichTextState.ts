import {BlockNode, Node, type TextDoc} from '#/core/TextDoc.js'
import type {ReactiveNode} from '#/dashboard/store/Dashboard.js'
import {atom} from 'jotai'

/** Reconciles a complete ProseMirror document while retaining block nodes. */
export function documentUpdateAtom(reactive: ReactiveNode<TextDoc>) {
  return atom(null, (get, set, nodes: TextDoc) => {
    nodes.forEach((node, index) => {
      const structure = get(reactive.nodes)
      if (!Array.isArray(structure)) return
      const children = structure as Array<ReactiveNode>
      if (Node.isBlock(node)) {
        const id = String(node[BlockNode.id])
        const currentIndex = children.findIndex(child => {
          const value = get(child.value)
          return Node.isBlock(value) && String(value[BlockNode.id]) === id
        })
        if (currentIndex < 0) set(reactive.insert, index, node)
        else if (currentIndex !== index) set(reactive.move, currentIndex, index)
        return
      }
      const current = children[index]
      if (current && !Node.isBlock(get(current.value))) set(current.value, node)
      else set(reactive.insert, index, node)
    })

    const structure = get(reactive.nodes)
    if (!Array.isArray(structure)) return
    for (let index = structure.length - 1; index >= nodes.length; index -= 1)
      set(reactive.remove, index)
  })
}
