import type {Type} from '#/core/Type.js'
import type {PropsWithChildren} from 'react'
import type {EditorNode} from '../atoms/editor.js'
import {EditorScope, useNodeEditor} from '../hooks.js'
import {FieldsEditor} from './EntryFields.js'

interface NodeEditorProps extends PropsWithChildren {
  node: EditorNode
  readOnly?: boolean
  /** Render the fields without their label, eg. in a compact row */
  inline?: boolean
  type: Type
}

/** Edits the fields of a nested node, eg. a list row or an object */
export function NodeEditor({
  children,
  node,
  readOnly,
  inline,
  type
}: NodeEditorProps) {
  const editor = useNodeEditor(node, type, readOnly, inline)
  return (
    <EditorScope editor={editor}>{children ?? <FieldsEditor />}</EditorScope>
  )
}
