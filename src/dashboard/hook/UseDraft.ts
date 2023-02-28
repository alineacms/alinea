import {useEffect} from 'react'
import {useQuery} from 'react-query'
import {EntryDraft} from '../draft/EntryDraft.js'
import {useDrafts} from './UseDrafts.js'
import {useSession} from './UseSession.js'

export function useDraft(id: string | undefined) {
  const {hub} = useSession()
  const docs = useDrafts()
  const {data: draft, isLoading} = useQuery(
    ['draft', id],
    async () => {
      if (!id) return undefined
      const {type, doc, ...detail} = await docs.get(id)
      return new EntryDraft(hub, type, detail, doc)
    },
    {
      suspense: true,
      keepPreviousData: true,
      refetchOnWindowFocus: false,
      retry: false
    }
  )
  useEffect(() => {
    if (id && draft) {
      const cancel = [docs.connect(id, draft.doc), draft.connect()]
      return () => cancel.forEach(c => c())
    }
  }, [draft])
  return {draft, isLoading}
}
