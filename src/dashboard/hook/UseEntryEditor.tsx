import {PropsWithChildren, createContext, useContext} from 'react'
import {EntryEditor} from '../atoms/EntryEditorAtoms.js'

const context = createContext(undefined as EntryEditor | undefined)

export function useEntryEditor(): EntryEditor | undefined {
  return useContext(context)
}

export interface EntryEditorProviderProps {
  editor: EntryEditor
}

export function EntryEditorProvider({
  children,
  editor
}: PropsWithChildren<EntryEditorProviderProps>) {
  return <context.Provider value={editor}>{children}</context.Provider>
}
