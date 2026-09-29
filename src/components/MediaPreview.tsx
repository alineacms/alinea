import styler from '@alinea/styler'
import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState
} from 'react'
import css from './MediaPreview.module.css'
import type {DataProps, StyleProps} from './types.js'

const styles = styler(css)

/** A point on an image, relative to its size: 0 to 1 on both axes */
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

export interface MediaPreviewProps extends StyleProps, DataProps {
  /** The image, leave out while it is being resolved */
  src?: string
  /** A small image shown blurred behind the preview, eg. a thumbhash data url */
  placeholder?: string
  /** Background color behind the placeholder */
  averageColor?: string
  /** Intrinsic width of the image, reserves its aspect ratio */
  width?: number
  /** Intrinsic height of the image, reserves its aspect ratio */
  height?: number
  alt?: string
  /** Shows a focal point marker on the image */
  focus?: FocusPoint
  /**
   * Makes the focal point editable by dragging, clicking or with the arrow
   * keys. Leave out for a read-only preview.
   */
  onFocusChange?: (focus: FocusPoint) => void
  /**
   * Reports the point under the pointer while hovering or dragging, and null
   * once the pointer leaves
   */
  onFocusHover?: (focus: FocusPoint | null) => void
  /** Accessible label of the focal point control, defaults to "Focus point" */
  focusLabel?: string
}

const clamp = (value: number) => Math.max(0, Math.min(1, value))
const round = (value: number) => Math.round(value * 100) / 100

function measure(container: HTMLElement, image: HTMLElement): ImageBounds {
  const outer = container.getBoundingClientRect()
  const inner = image.getBoundingClientRect()
  return {
    left: inner.left - outer.left,
    top: inner.top - outer.top,
    width: inner.width,
    height: inner.height
  }
}

/** An image preview with an optional, editable focal point */
export function MediaPreview({
  src,
  placeholder,
  averageColor,
  width,
  height,
  alt = '',
  focus,
  onFocusChange,
  onFocusHover,
  focusLabel = 'Focus point',
  className,
  style,
  ...props
}: MediaPreviewProps) {
  const editable = Boolean(onFocusChange)
  const [loadedSrc, setLoadedSrc] = useState<string>()
  const [dragFocus, setDragFocus] = useState<FocusPoint | null>(null)
  const [bounds, setBounds] = useState<ImageBounds | null>(null)
  const areaRef = useRef<HTMLDivElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const markerRef = useRef<HTMLDivElement | null>(null)
  const isVisible = Boolean(src) && loadedSrc === src

  // The focal point is placed on the letterboxed image, which is measured.
  // eslint-disable react-you-might-not-need-an-effect/no-external-store-subscription, react-you-might-not-need-an-effect/no-adjust-state-on-prop-change
  useEffect(() => {
    const area = areaRef.current
    const image = imageRef.current
    if (!area || !image) return
    function update() {
      if (area && image) setBounds(measure(area, image))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(area)
    observer.observe(image)
    return () => observer.disconnect()
  }, [isVisible, src])
  // eslint-enable react-you-might-not-need-an-effect/no-external-store-subscription, react-you-might-not-need-an-effect/no-adjust-state-on-prop-change

  function locate(event: PointerEvent<HTMLDivElement>): FocusPoint {
    const rect = imageRef.current?.getBoundingClientRect()
    const target =
      rect && rect.width > 0 && rect.height > 0
        ? rect
        : event.currentTarget.getBoundingClientRect()
    return {
      x: clamp((event.clientX - target.left) / target.width),
      y: clamp((event.clientY - target.top) / target.height)
    }
  }

  function release(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!focus || !onFocusChange) return
    const step = event.shiftKey ? 0.1 : 0.01
    let {x, y} = focus
    switch (event.key) {
      case 'ArrowLeft':
        x -= step
        break
      case 'ArrowRight':
        x += step
        break
      case 'ArrowUp':
        y -= step
        break
      case 'ArrowDown':
        y += step
        break
      default:
        return
    }
    event.preventDefault()
    onFocusChange({x: round(clamp(x)), y: round(clamp(y))})
  }

  const marker = dragFocus ?? focus
  const percent = (value: number) => `${Math.round(value * 100)}%`

  return (
    <div
      data-slot="media-preview"
      {...props}
      className={styles.MediaPreview(styler.merge({className}))}
      style={{
        backgroundColor: averageColor,
        backgroundImage: placeholder ? `url("${placeholder}")` : undefined,
        ...style
      }}
    >
      <div
        ref={areaRef}
        data-slot="media-preview-area"
        data-editable={editable || undefined}
        className={styles.MediaPreview.area()}
        style={{
          aspectRatio: width && height ? `${width} / ${height}` : undefined
        }}
        onPointerMove={event => {
          if (!editable) return
          const point = locate(event)
          if (dragFocus) setDragFocus(point)
          onFocusHover?.(point)
        }}
        onPointerDown={event => {
          if (!editable || event.button !== 0) return
          event.preventDefault()
          event.currentTarget.setPointerCapture(event.pointerId)
          markerRef.current?.focus({preventScroll: true})
          const point = locate(event)
          setDragFocus(point)
          onFocusHover?.(point)
        }}
        onPointerUp={event => {
          if (!dragFocus) return
          const point = locate(event)
          setDragFocus(null)
          release(event)
          onFocusChange?.(point)
          onFocusHover?.(point)
        }}
        onPointerCancel={event => {
          setDragFocus(null)
          release(event)
          onFocusHover?.(null)
        }}
        onPointerLeave={() => {
          if (!dragFocus) onFocusHover?.(null)
        }}
      >
        {src && (
          <img
            ref={imageRef}
            data-slot="media-preview-image"
            className={styles.MediaPreview.image()}
            src={src}
            alt={alt}
            draggable={false}
            data-visible={isVisible || undefined}
            onLoad={event => {
              setLoadedSrc(src)
              if (areaRef.current)
                setBounds(measure(areaRef.current, event.currentTarget))
            }}
          />
        )}
        {marker && (
          <div
            data-slot="media-preview-focus"
            className={styles.MediaPreview.focus()}
            style={{
              left: bounds
                ? `${bounds.left + marker.x * bounds.width}px`
                : `${marker.x * 100}%`,
              top: bounds
                ? `${bounds.top + marker.y * bounds.height}px`
                : `${marker.y * 100}%`
            }}
            ref={markerRef}
            role={editable ? 'slider' : undefined}
            tabIndex={editable ? 0 : undefined}
            aria-hidden={editable ? undefined : true}
            aria-label={editable ? focusLabel : undefined}
            aria-roledescription={editable ? '2D slider' : undefined}
            aria-valuemin={editable ? 0 : undefined}
            aria-valuemax={editable ? 100 : undefined}
            aria-valuenow={editable ? Math.round(marker.x * 100) : undefined}
            aria-valuetext={
              editable
                ? `${percent(marker.x)} from the left, ${percent(marker.y)} from the top`
                : undefined
            }
            onKeyDown={editable ? handleKeyDown : undefined}
          >
            <span className={styles.MediaPreview.focus.ring()} />
            <span className={styles.MediaPreview.focus.dot()} />
          </div>
        )}
      </div>
    </div>
  )
}
