import {createContext, useContext, useEffect, useState} from 'react'
import {EntryDraft, EntryDraftStatus} from '../EntryDraft'

const context = createContext<EntryDraft | undefined>(undefined)

export function useCurrentDraft(): [EntryDraft, EntryDraftStatus] {
  const draft = useContext(context)!
  const [status, setStatus] = useState(EntryDraftStatus.Synced)
  useEffect(() => {
    setStatus(EntryDraftStatus.Synced)
    return draft.watchStatus(setStatus)
  }, [draft])
  return [draft, status]
}

export const CurrentDraftProvider = context.Provider
