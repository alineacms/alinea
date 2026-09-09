import {useEffect, useRef, useState} from 'react'
import {type PreviewApi, registerPreview} from './RegisterPreview.js'

export interface UsePreviewOptions {
  hostOrigin: string
  preview: PreviewApi['preview']
}

export function usePreview(options: UsePreviewOptions) {
  const [isPreviewing, setIsPreviewing] = useState(false)
  const previewRef = useRef(options.preview)
  previewRef.current = options.preview
  useEffect(() => {
    return registerPreview(
      {
        preview(update) {
          return previewRef.current(update)
        },
        setIsPreviewing
      },
      options.hostOrigin
    )
  }, [options.hostOrigin])
  return {isPreviewing}
}
