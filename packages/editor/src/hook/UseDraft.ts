import {Entry} from '@alinea/core/Entry'
import {Outcome} from '@alinea/core/Outcome'
import {Type} from '@alinea/core/Type'
import {useEffect, useMemo} from 'react'
import {EntryDraft} from '../EntryDraft'

export function useDraft(
  type: Type,
  data: Entry.WithDraft,
  saveDraft: (doc: string) => Promise<Outcome<void>>
) {
  const current = useMemo(() => {
    if (data) return new EntryDraft(type, data.entry, data.draft, saveDraft)
    return null
  }, [data, saveDraft])
  useEffect(() => {
    if (current) return current.connect()
  }, [current])
  return current
}
