// @ts-ignore
import {useNavigate} from '@remix-run/react'
import {usePreview as useReactPreview} from './react'

export function usePreview() {
  const navigate = useNavigate()
  return useReactPreview({
    async refetch() {
      // See https://github.com/remix-run/remix/discussions/1996
      // In preview mode the downside are completely acceptable
      navigate('.', {replace: true})
    }
  })
}
