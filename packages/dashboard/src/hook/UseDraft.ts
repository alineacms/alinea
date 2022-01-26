import {EntryDraft} from '@alinea/editor/EntryDraft'
import {useEffect} from 'react'
import {useQuery} from 'react-query'
import {useDrafts} from './UseDrafts'

export function useDraft(id: string) {
  const docs = useDrafts()
  const {data: draft} = useQuery(
    ['draft', id],
    () => {
      return docs.get(id).then(({type, entry, doc}) => {
        return new EntryDraft(type, entry, doc)
      })
    },
    {
      suspense: true,
      keepPreviousData: true,
      refetchOnWindowFocus: false
    }
  )
  useEffect(() => {
    if (draft) {
      const cancel = [docs.connect(id, draft.doc), draft.connect()]
      return () => cancel.forEach(c => c())
    }
  }, [draft])
  return draft
}
