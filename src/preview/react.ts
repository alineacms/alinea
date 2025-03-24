import {useEffect, useState} from 'react'
import {type PreviewApi, registerPreview} from './RegisterPreview.js'

export function usePreview(api: Omit<PreviewApi, 'setIsPreviewing'>) {
  const [isPreviewing, setIsPreviewing] = useState(false)
  useEffect(() => {
    return registerPreview({...api, setIsPreviewing})
  }, [])
  return {isPreviewing}
}
