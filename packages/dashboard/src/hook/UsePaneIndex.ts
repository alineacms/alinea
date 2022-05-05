import { createContext, useContext } from 'react'

type PaneIndexContextType = {
  index: number
  setIndex: (n: number) => void
}

const context = createContext<PaneIndexContextType | undefined>(undefined)
export function usePaneIndex() {
  return useContext(context)
}

export const PaneIndexProvider = context.Provider