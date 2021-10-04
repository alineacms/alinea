import {Entry} from '@alinea/core/Entry'
import {Outcome} from '@alinea/core/Outcome'
import {useEffect, useMemo} from 'react'
import {EntryDraft} from '../EntryDraft'

export function useDraft(
  data: Entry.WithDraft,
  saveDraft: (doc: string) => Promise<Outcome<void>>
) {
  const current = useMemo(() => {
    if (data) return new EntryDraft(data.entry, data.draft, saveDraft)
    else return null
  }, [data, saveDraft])
  useEffect(() => {
    if (current) return current.connect()
  }, [current])
  return current
}
