import {BlockNode, Node, type TextDoc} from '#/core/TextDoc.js'
import {isRecord} from '#/core/util/Objects.js'
import type {ReactiveNode} from '#/dashboard/atoms/entry/editor.js'
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
        else {
          const current = children[currentIndex]
          const value = get(current.value)
          if (!sameBlockType(value, node)) set(current.value, node)
          if (currentIndex !== index) set(reactive.move, currentIndex, index)
        }
        return
      }
      const current = children[index]
      if (current && !Node.isBlock(get(current.value))) {
        if (!sameValue(get(current.value), node)) set(current.value, node)
      } else set(reactive.insert, index, node)
    })

    const structure = get(reactive.nodes)
    if (!Array.isArray(structure)) return
    for (let index = structure.length - 1; index >= nodes.length; index -= 1)
      set(reactive.remove, index)
  })
}

function sameValue(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false
    return (
      left.length === right.length &&
      left.every((value, index) => sameValue(value, right[index]))
    )
  }
  if (!isRecord(left) || !isRecord(right)) return false
  const keys = Object.keys(left)
  return (
    keys.length === Object.keys(right).length &&
    keys.every(
      key =>
        Object.prototype.hasOwnProperty.call(right, key) &&
        sameValue(left[key], right[key])
    )
  )
}

function sameBlockType(left: unknown, right: BlockNode): boolean {
  return Node.isBlock(left) && left[Node.type] === right[Node.type]
}
