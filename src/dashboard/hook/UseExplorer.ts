import {Reference} from 'alinea/core'
import {createContext, useContext} from 'react'
import {ExporerItemSelect} from '../view/explorer/Explorer.js'

type ExplorerContext = {
  selectable?: Array<string> | boolean
  selection: Array<Reference>
  onSelect: (entry: ExporerItemSelect) => void
  onNavigate?: (entryId: string) => void
  showMedia?: boolean
  withNavigation?: boolean
  border?: boolean
}

const context = createContext<ExplorerContext | undefined>(undefined)

export function useExplorer() {
  return useContext(context)!
}

export const ExplorerProvider = context.Provider
