import {useMemo} from 'react'

export function useTranslation<T>(copy: T): T {
  return useMemo(() => copy, [])
}
