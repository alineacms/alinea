import {Entry, Reference} from '@alinea/core'
import {createContext, useContext} from 'react'

type ExplorerContext = {
  selectable: boolean
  selection: Array<Reference>
  onSelect: (id: Entry.Minimal) => void
}

const context = createContext<ExplorerContext | undefined>(undefined)

export function useExplorer() {
  return useContext(context)!
}

export const ExplorerProvider = context.Provider
