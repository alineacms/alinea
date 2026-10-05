import {MediaPreview, type FocusPoint} from '#/components.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import {useField} from '#/dashboard/hooks.js'
import {styler} from '@alinea/styler'
import {useEffect, useState} from 'react'
import css from './FilePreview.module.css'

const styles = styler(css)

export type {FocusPoint}

export interface FilePreviewProps {
  liveUrl?: string
  preview: string
  /** Thumbhash data url shown behind the image */
  placeholder?: string
  width?: number
  height?: number
  onHoverPointChange?: (focusPoint: FocusPoint | null) => void
}

export function FilePreview({
  liveUrl,
  preview,
  placeholder,
  width,
  height,
  onHoverPointChange
}: FilePreviewProps) {
  const [focusPoint = {x: 0.5, y: 0.5}, setFocusPoint] = useField(
    MediaFile.focus
  )
  const [previewSource, setPreviewSource] = useState<string | undefined>(
    liveUrl ? undefined : preview
  )

  // Preload the live URL before swapping from the static preview, and fall back
  // if it fails. This keeps broken live media URLs from flashing in the UI.
  // eslint-disable react-you-might-not-need-an-effect/no-adjust-state-on-prop-change
  useEffect(() => {
    if (!liveUrl) {
      setPreviewSource(preview)
      return
    }

    let isActive = true
    const image = new Image()
    image.onload = () => {
      if (isActive) setPreviewSource(liveUrl)
    }
    image.onerror = () => {
      if (isActive) setPreviewSource(preview)
    }
    image.src = liveUrl
    return () => {
      isActive = false
      image.onload = null
      image.onerror = null
    }
  }, [liveUrl, preview])
  // eslint-enable react-you-might-not-need-an-effect/no-adjust-state-on-prop-change

  return (
    <MediaPreview
      className={styles.FilePreview()}
      src={previewSource}
      placeholder={placeholder}
      width={width}
      height={height}
      alt="Preview of media file"
      focus={focusPoint}
      onFocusChange={setFocusPoint}
      onFocusHover={onHoverPointChange}
    />
  )
}
