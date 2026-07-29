import type {EntryAnchorTarget} from '#/core/Field.js'
import type {Resource} from '#/core/Role.js'
import type {Type} from '#/core/Type.js'
import {assert} from '#/core/util/Assert.js'
import {useAtomValue} from 'jotai'
import type {PropsWithChildren} from 'react'
import {createContext, createElement, useContext, useMemo} from 'react'
import {
  createEditor,
  rootEditor,
  type EditorAtoms
} from '../atoms/entry/editor.js'
import type {ReactiveNode} from '../atoms/entry/editor.js'

const editorContext = createContext<EditorAtoms | null>(null)

export interface EditorScopeProps {
  editor: EditorAtoms
}

export function EditorScope({
  children,
  editor
}: PropsWithChildren<EditorScopeProps>) {
  return createElement(editorContext.Provider, {value: editor}, children)
}

export function useOptionalEditor(): EditorAtoms | null {
  return useContext(editorContext)
}

export function useEditor(): EditorAtoms {
  const editor = useOptionalEditor()
  assert(editor, 'Editor scope not found')
  return editor
}

/**
 * Creates an editor for a nested reactive node.
 */
export function useNodeEditor(
  node: ReactiveNode<object>,
  type: Type,
  resource?: Resource
): EditorAtoms {
  const parent = useOptionalEditor()
  return useMemo(
    () => createEditor(type, node, parent ?? undefined, resource),
    [node, parent, resource, type]
  )
}

/**
 * Returns all anchors in the entry currently being edited.
 */
export function useEntryAnchors(): Array<EntryAnchorTarget> {
  return useAtomValue(rootEditor(useEditor()).anchors)
}
