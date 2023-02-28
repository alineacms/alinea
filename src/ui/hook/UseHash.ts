// Based on: https://github.com/streamich/react-use/blob/e53ca94a0b1f20270b0f75dc2ca1fecf1e119dde/src/useHash.ts

import {useCallback, useEffect, useState} from 'react'

export function useHash() {
  const [hash, setHash] = useState(() => window.location.hash)

  useEffect(() => {
    function hashChange() {
      setHash(window.location.hash)
    }
    window.addEventListener('hashchange', hashChange)
    return () => window.removeEventListener('hashchange', hashChange)
  }, [])

  const _setHash = useCallback(
    (newHash: string) => {
      if (newHash !== hash) window.location.hash = newHash
    },
    [hash]
  )

  return [hash, _setHash] as const
}
