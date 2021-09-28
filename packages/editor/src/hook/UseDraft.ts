import {useEffect, useMemo, useState} from 'react'
import {EntryDraft} from '..'

export function useDraft(path: string) {
  const [current, setCurrent] = useState<EntryDraft | null>(null)
  const loading = useMemo(() => new EntryDraft(path), [path])
  // Todo: find a better way to check when an entry is sufficiently
  // loaded before displaying it.
  useEffect(() => {
    if (loading.$channel && current !== loading) {
      setCurrent(loading)
    } else {
      const checkLoaded = () => {
        if (!loading.$channel) return
        loading.doc.off('update', checkLoaded)
        setCurrent(loading)
      }
      loading.doc.on('update', checkLoaded)
      return () => loading.doc.off('update', checkLoaded)
    }
  }, [loading])
  useEffect(() => {
    if (current) return () => current.destroy()
  }, [current])
  return current
}
