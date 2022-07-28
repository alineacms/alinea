import {useRouter} from 'next/router'
import {usePreview} from './react'

export function useNextPreview() {
  const router = useRouter()
  return usePreview({
    refetch() {
      router.replace(router.asPath, undefined, {scroll: false})
    }
  })
}
