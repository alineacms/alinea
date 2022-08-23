import {useEffect, useState} from 'react'
import {PreviewApi, registerPreview} from './RegisterPreview'

export function usePreview(api: PreviewApi = {}) {
  const [isPreviewing, setIsPreviewing] = useState(false)
  useEffect(() => {
    return registerPreview({...api, setIsPreviewing})
  }, [])
  return {isPreviewing}
}
