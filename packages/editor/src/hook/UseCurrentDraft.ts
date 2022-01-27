import {createContext, useContext} from 'react'
import {EntryDraft} from '../EntryDraft'

const context = createContext<EntryDraft | undefined>(undefined)

export function useCurrentDraft(): EntryDraft {
  return useContext(context)!
}

export const CurrentDraftProvider = context.Provider
