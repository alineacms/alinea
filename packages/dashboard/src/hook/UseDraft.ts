import {EntryDraft} from '@alinea/editor/EntryDraft'
import {useEffect} from 'react'
import {useQuery} from 'react-query'
import {useDrafts} from './UseDrafts'
import {useSession} from './UseSession'

export function useDraft(id: string | undefined) {
  const {hub} = useSession()
  const docs = useDrafts()
  const {data: draft} = useQuery(
    ['draft', id],
    () => {
      if (!id) return undefined
      return docs.get(id).then(({type, parents, entry, doc}) => {
        return new EntryDraft(hub, type, entry, parents, doc)
      })
    },
    {
      suspense: true,
      keepPreviousData: true,
      refetchOnWindowFocus: false
    }
  )
  useEffect(() => {
    if (id && draft) {
      const cancel = [docs.connect(id, draft.doc), draft.connect()]
      return () => cancel.forEach(c => c())
    }
  }, [draft])
  return draft
}
