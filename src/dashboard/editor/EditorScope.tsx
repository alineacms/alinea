import {assert} from '#/core/util/Assert.js'
import type {PropsWithChildren} from 'react'
import {createContext, createElement, useContext} from 'react'
import type {Editor} from '../atoms/EditorAtoms.js'

const editorContext = createContext<Editor | null>(null)

export interface EditorScopeProps {
  editor: Editor
}

export function EditorScope({
  children,
  editor
}: PropsWithChildren<EditorScopeProps>) {
  return createElement(editorContext.Provider, {value: editor}, children)
}

export function useOptionalEditor(): Editor | null {
  return useContext(editorContext)
}

export function useEditor(): Editor {
  const editor = useOptionalEditor()
  assert(editor, 'Editor scope not found')
  return editor
}
