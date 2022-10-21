import {useRouter} from 'next/router.js'
import {usePreview as useReactPreview} from './react'

export function usePreview() {
  const router = useRouter()
  return useReactPreview({
    async refetch() {
      try {
        await router.replace(router.asPath, undefined, {scroll: false})
      } catch (e) {}
    }
  })
}

export const useNextPreview = usePreview
