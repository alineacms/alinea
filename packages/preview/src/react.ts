import {useMemo} from 'react'
import {PreviewApi, registerPreview} from './RegisterPreview'

export function usePreview(api: PreviewApi = {}) {
  useMemo(() => {
    return registerPreview(api)
  }, [])
}
