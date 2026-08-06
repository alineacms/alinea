import {useEffect, useRef, useState} from 'react'
import {type PreviewApi, registerPreview} from './RegisterPreview.js'

export function usePreview(api: Omit<PreviewApi, 'setIsPreviewing'>) {
  const [isPreviewing, setIsPreviewing] = useState(false)
  const apiRef = useRef(api)
  apiRef.current = api
  useEffect(() => {
    return registerPreview({
      preview(update) {
        return apiRef.current.preview(update)
      },
      setIsPreviewing
    })
  }, [])
  return {isPreviewing}
}
