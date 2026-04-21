import {MediaFile} from '#/core/media/MediaTypes.js'
import {styler} from '@alinea/styler'
import type {PointerEvent} from 'react'
import {useField} from '#/dashboard/store.js'
import {useEffect, useRef, useState} from 'react'
import css from './FilePreview.module.css'

const styles = styler(css)

export interface FocusPoint {
  x: number
  y: number
}

interface ImageBounds {
  left: number
  top: number
  width: number
  height: number
}

export interface FilePreviewProps {
  liveUrl?: string
  preview: string
  thumbBackground?: string
  width?: number
  height?: number
  onHoverPointChange?: (focusPoint: FocusPoint | null) => void
}

export function FilePreview({
  liveUrl,
  preview,
  thumbBackground,
  width,
  height,
  onHoverPointChange
}: FilePreviewProps) {
  const [focusPoint = {x: 0.5, y: 0.5}, setFocusPoint] = useField(
    MediaFile.focus
  )
  const [isDraggingFocusPoint, setIsDraggingFocusPoint] = useState(false)
  const [previewSource, setPreviewSource] = useState<string | undefined>(
    liveUrl ? undefined : preview
  )
  const [isPreviewVisible, setIsPreviewVisible] = useState(false)
  const [imageBounds, setImageBounds] = useState<ImageBounds | null>(null)
  const interactiveRef = useRef<HTMLDivElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    setIsPreviewVisible(false)
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

  useEffect(() => {
    function updateImageBounds() {
      const interactiveElement = interactiveRef.current
      const imageElement = imageRef.current
      if (!interactiveElement || !imageElement) return
      const interactiveRect = interactiveElement.getBoundingClientRect()
      const imageRect = imageElement.getBoundingClientRect()
      setImageBounds({
        left: imageRect.left - interactiveRect.left,
        top: imageRect.top - interactiveRect.top,
        width: imageRect.width,
        height: imageRect.height
      })
    }

    updateImageBounds()
    const resizeObserver = new ResizeObserver(updateImageBounds)
    const interactiveElement = interactiveRef.current
    const imageElement = imageRef.current
    if (!interactiveElement || !imageElement) return
    resizeObserver.observe(interactiveElement)
    resizeObserver.observe(imageElement)
    window.addEventListener('resize', updateImageBounds)
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateImageBounds)
    }
  }, [isPreviewVisible, previewSource])

  function locateFocusPoint(
    event: PointerEvent<HTMLDivElement>
  ): FocusPoint {
    const rect = imageRef.current?.getBoundingClientRect()
    const fallbackRect = event.currentTarget.getBoundingClientRect()
    const targetRect = rect && rect.width > 0 && rect.height > 0 ? rect : fallbackRect
    const x = (event.clientX - targetRect.left) / targetRect.width
    const y = (event.clientY - targetRect.top) / targetRect.height
    return {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y))
    }
  }

  return (
    <div
      className={styles.FilePreview()}
      style={{backgroundImage: thumbBackground}}
    >
      <div
        ref={interactiveRef}
        className={styles.FilePreview.interactive()}
        style={{
          aspectRatio:
            width && height ? `${width} / ${height}` : undefined
        }}
        onPointerMove={event => onHoverPointChange?.(locateFocusPoint(event))}
        onPointerDown={event => {
          event.preventDefault()
          event.currentTarget.setPointerCapture(event.pointerId)
          setIsDraggingFocusPoint(true)
          onHoverPointChange?.(locateFocusPoint(event))
        }}
        onPointerUp={event => {
          const point = locateFocusPoint(event)
          setFocusPoint(point)
          setIsDraggingFocusPoint(false)
          onHoverPointChange?.(point)
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
          }
        }}
        onPointerCancel={event => {
          setIsDraggingFocusPoint(false)
          onHoverPointChange?.(null)
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
          }
        }}
        onPointerLeave={() => {
          if (!isDraggingFocusPoint) onHoverPointChange?.(null)
        }}
        onBlur={() => onHoverPointChange?.(null)}
      >
        {previewSource && (
          <img
            ref={imageRef}
            className={styles.FilePreview.image()}
            src={previewSource}
            alt="Preview of media file"
            draggable={false}
            data-visible={isPreviewVisible || undefined}
            onDragStart={event => event.preventDefault()}
            onLoad={() => {
              setIsPreviewVisible(true)
              const interactiveElement = interactiveRef.current
              const imageElement = imageRef.current
              if (!interactiveElement || !imageElement) return
              const interactiveRect = interactiveElement.getBoundingClientRect()
              const imageRect = imageElement.getBoundingClientRect()
              setImageBounds({
                left: imageRect.left - interactiveRect.left,
                top: imageRect.top - interactiveRect.top,
                width: imageRect.width,
                height: imageRect.height
              })
            }}
          />
        )}
        <span
          className={styles.FilePreview.focus()}
          style={{
            left: imageBounds
              ? `${imageBounds.left + focusPoint.x * imageBounds.width}px`
              : `${focusPoint.x * 100}%`,
            top: imageBounds
              ? `${imageBounds.top + focusPoint.y * imageBounds.height}px`
              : `${focusPoint.y * 100}%`
          }}
        >
          <span className={styles.FilePreview.focus.inner()} />
          <span className={styles.FilePreview.focus.dot()} />
        </span>
      </div>
    </div>
  )
}
