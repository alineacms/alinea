import type {Reference} from 'alinea/core/Reference'
import {createContext, useContext} from 'react'
import type {ExporerItemSelect} from '../view/explorer/Explorer.js'

type ExplorerContext = {
  selectable?: Array<string> | boolean
  selection: Array<Reference>
  onSelect: (entry: ExporerItemSelect) => void
  onNavigate?: (id: string) => void
  showMedia?: boolean
  withNavigation?: boolean
  border?: boolean
}

const context = createContext<ExplorerContext | undefined>(undefined)

export function useExplorer() {
  return useContext(context)!
}

export const ExplorerProvider = context.Provider
