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
      let isRemoved = false
      function checkLoaded() {
        if (!loading.$channel) return
        off()
        setCurrent(loading)
      }
      const off = () => {
        if (!isRemoved) loading.doc.getMap('root').unobserve(checkLoaded)
        isRemoved = true
      }
      loading.doc.getMap('root').observe(checkLoaded)
      return off
    }
  }, [loading])
  useEffect(() => {
    if (current) return () => current.destroy()
  }, [current])
  return current
}
