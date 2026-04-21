import {Config} from '#/core/Config.js'
import {isImage as isImageExtension} from '#/core/media/IsImage.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import {outcome} from '#/core/Outcome.js'
import {base64} from '#/core/util/Encoding.js'
import {
  DashboardEntry,
  useDashboard,
  useField,
  useFieldValue
} from '#/dashboard/store.js'
import {styler} from '@alinea/styler'
import {useAtomValue} from 'jotai'
import prettyBytes from 'pretty-bytes'
import type {PointerEvent} from 'react'
import {useMemo, useState} from 'react'
import {thumbHashToDataURL} from 'thumbhash'
import {FieldsEditor} from '../Editor'
import {Surface} from '../ui/Surface'
import css from './FileEditor.module.css'

const styles = styler(css)

interface FocusPoint {
  x: number
  y: number
}

interface FileEditorProps {
  entry: DashboardEntry
}

export function FileEditor({entry}: FileEditorProps) {
  const dashboard = useDashboard()
  const config = useAtomValue(dashboard.config)
  const location = useFieldValue(MediaFile.location)
  const extension = useFieldValue(MediaFile.extension)
  const isImage = isImageExtension(extension)
  const size = useFieldValue(MediaFile.size)
  const width = useFieldValue(MediaFile.width)
  const height = useFieldValue(MediaFile.height)
  const preview = useFieldValue(MediaFile.preview)
  const thumbHash = useFieldValue(MediaFile.thumbHash)
  const thumbBackground = useMemo(() => {
    if (!thumbHash) return undefined
    return `url(${thumbHashToDataURL(base64.parse(thumbHash))}`
  }, [thumbHash])
  const [focusPoint = {x: 0.5, y: 0.5}, setFocusPoint] = useField(
    MediaFile.focus
  )
  const [hoverPoint, setHoverPoint] = useState<FocusPoint | null>(null)
  const [isDraggingFocusPoint, setIsDraggingFocusPoint] = useState(false)
  const [liveUrl] = outcome(
    () => new URL(location, Config.baseUrl(config) ?? window.location.href)
  )
  const displayedFocusPoint = hoverPoint ?? focusPoint

  function locateFocusPoint(
    event: PointerEvent<HTMLDivElement>
  ): FocusPoint {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width
    const y = (event.clientY - rect.top) / rect.height
    return {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y))
    }
  }

  return (
    <Surface>
      <div className={styles.FileEditor()}>
        {isImage && (
          <div
            className={styles.FileEditor.preview()}
            style={{backgroundImage: thumbBackground}}
          >
            <div
              className={styles.FileEditor.preview.interactive()}
              onPointerMove={event => setHoverPoint(locateFocusPoint(event))}
              onPointerDown={event => {
                event.preventDefault()
                event.currentTarget.setPointerCapture(event.pointerId)
                setIsDraggingFocusPoint(true)
                setHoverPoint(locateFocusPoint(event))
              }}
              onPointerUp={event => {
                setFocusPoint(locateFocusPoint(event))
                setIsDraggingFocusPoint(false)
                event.currentTarget.releasePointerCapture(event.pointerId)
              }}
              onPointerCancel={event => {
                setIsDraggingFocusPoint(false)
                setHoverPoint(null)
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId)
                }
              }}
              onPointerLeave={() => {
                if (!isDraggingFocusPoint) setHoverPoint(null)
              }}
              onBlur={() => setHoverPoint(null)}
            >
              <img
                className={styles.FileEditor.preview.image()}
                src={preview}
                alt="Preview of media file"
                draggable={false}
                onDragStart={event => event.preventDefault()}
              />
              <span
                className={styles.FileEditor.preview.focus()}
                style={{
                  left: `${focusPoint.x * 100}%`,
                  top: `${focusPoint.y * 100}%`
                }}
              >
                <span className={styles.FileEditor.preview.focus.inner()} />
                <span className={styles.FileEditor.preview.focus.dot()} />
              </span>
            </div>
          </div>
        )}
        <div className={styles.FileEditor.details()}>
          <Surface variant="muted">
            <div>
              <strong>Extension</strong>
              <span>{extension}</span>
            </div>

            <div>
              <strong>File size</strong>
              <span>{prettyBytes(size)}</span>
            </div>
            {liveUrl && (
              <div>
                <strong>URL</strong>
                <span>{liveUrl.pathname}</span>
              </div>
            )}
            {isImage && (
              <>
                <div>
                  <strong>Dimensions</strong>
                  <span>
                    {width}px x {height}px
                  </span>
                </div>
              </>
            )}
          </Surface>
          <div>
            <strong>Focus point</strong>
            <span>
              ({displayedFocusPoint.x.toFixed(2)}, {displayedFocusPoint.y.toFixed(2)})
            </span>
          </div>
          <FieldsEditor />
        </div>
      </div>
    </Surface>
  )
}
