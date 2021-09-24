import {createContext, useContext} from 'react'
import {EntryDraft} from '../EntryDraft'

const context = createContext<EntryDraft | undefined>(undefined)

export function useEntryDraft() {
  return useContext(context)
}

export const EntryDraftProvider = context.Provider
