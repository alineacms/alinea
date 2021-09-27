import {useEffect, useMemo, useState} from 'react'
import {EntryDraft} from '..'

export function useDraft(path: string) {
  const draft = useMemo(() => new EntryDraft(path), [path])
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    if (draft.channel && !loaded) {
      setLoaded(true)
    } else {
      if (loaded) setLoaded(false)
      // Todo: find a proper way to wait for first sync of document to complete
      const checkLoaded = () => {
        if (!draft.channel) return
        draft.doc.off('update', checkLoaded)
        setLoaded(true)
      }
      draft.doc.on('update', checkLoaded)
    }
    if (draft) return () => draft.destroy()
  }, [draft])
  if (!loaded) return null
  return draft
}
