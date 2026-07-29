import {assert} from '#/core/util/Assert.js'
import type {PropsWithChildren} from 'react'
import {createContext, createElement, useContext} from 'react'
import type {EditorAtoms} from '../atoms/EditorAtoms.js'

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
