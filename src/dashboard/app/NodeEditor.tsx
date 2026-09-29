import type {Type} from '#/core/Type.js'
import type {PropsWithChildren} from 'react'
import type {EditorNode} from '../atoms/editor.js'
import {EditorScope, useNodeEditor} from '../hooks.js'
import {FieldsEditor} from './EntryFields.js'

interface NodeEditorProps extends PropsWithChildren {
  node: EditorNode
  readOnly?: boolean
  type: Type
}

/** Edits the fields of a nested node, eg. a list row or an object */
export function NodeEditor({children, node, readOnly, type}: NodeEditorProps) {
  const editor = useNodeEditor(node, type, readOnly)
  return (
    <EditorScope editor={editor}>{children ?? <FieldsEditor />}</EditorScope>
  )
}
