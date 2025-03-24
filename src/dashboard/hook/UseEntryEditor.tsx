import {type PropsWithChildren, createContext, useContext} from 'react'
import type {EntryEditor} from '../atoms/EntryEditorAtoms.js'

const ctx = createContext(undefined as EntryEditor | undefined)

export function useEntryEditor(): EntryEditor | undefined {
  return useContext(ctx)
}

export interface EntryEditorProviderProps {
  editor: EntryEditor
}

export function EntryEditorProvider({
  children,
  editor
}: PropsWithChildren<EntryEditorProviderProps>) {
  return <ctx.Provider value={editor}>{children}</ctx.Provider>
}
