import {useEffect, useState} from 'react'
import {PreviewApi, registerPreview} from './RegisterPreview.js'

export function usePreview(api: Omit<PreviewApi, 'setIsPreviewing'>) {
  const [isPreviewing, setIsPreviewing] = useState(false)
  useEffect(() => {
    return registerPreview({...api, setIsPreviewing})
  }, [])
  return {isPreviewing}
}
