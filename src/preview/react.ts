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
  const applied = useRef<string>()
  useEffect(() => {
    return registerPreview(
      {
        preview(update) {
          // Strict mode registers twice in development, so the host answers
          // two pings with the same payload. Applying it again would refresh
          // the page a second time and abort the first refresh.
          if (update?.payload === applied.current) return Promise.resolve()
          applied.current = update?.payload
          return previewRef.current(update)
        },
        setIsPreviewing
      },
      options.hostOrigin
    )
  }, [options.hostOrigin])
  return {isPreviewing}
}
