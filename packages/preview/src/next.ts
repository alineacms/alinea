import {useRouter} from 'next/router.js'
import {usePreview} from './react'

export function useNextPreview() {
  const router = useRouter()
  return usePreview({
    async refetch() {
      try {
        router.replace(router.asPath, undefined, {scroll: false})
      } catch (e) {}
    }
  })
}
