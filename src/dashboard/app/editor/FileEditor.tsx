import {type} from '#/config.js'
import {Config} from '#/core/Config.js'
import {isImage as isImageExtension} from '#/core/media/IsImage.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import {outcome} from '#/core/Outcome.js'
import {base64} from '#/core/util/Encoding.js'
import {
  DashboardEntryData,
  useDashboard,
  useEditor,
  useField,
  useFieldValue
} from '#/dashboard/store.js'
import {localiser, text} from '#/field.js'
import {styler} from '@alinea/styler'
import {useAtomValue} from 'jotai'
import prettyBytes from 'pretty-bytes'
import {useMemo, useState} from 'react'
import {thumbHashToDataURL} from 'thumbhash'
import {FieldsEditor, NodeEditor} from '../Editor.js'
import {Surface} from '../ui/Surface.js'
import css from './FileEditor.module.css'
import {FilePreview, type FocusPoint} from './FilePreview.js'

const styles = styler(css)

interface FileEditorProps {
  entry: DashboardEntryData
}

const alt = text('Alt text', {
  multiline: true,
  help: 'Describe the image for screen readers and SEO'
})

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
  const [focusPoint = {x: 0.5, y: 0.5}] = useField(MediaFile.focus)
  const [hoverPoint, setHoverPoint] = useState<FocusPoint | null>(null)
  const [liveUrl] = outcome(
    () => new URL(location, Config.baseUrl(config) ?? window.location.href)
  )
  const displayedFocusPoint = hoverPoint ?? focusPoint
  const workspace = useAtomValue(entry.workspaceKey)
  const root = useAtomValue(entry.rootKey)
  const i18n = useAtomValue(dashboard.workspace(workspace).root(root).mediaI18n)
  const extra = useMemo(() => {
    const altField = i18n ? localiser(i18n)(alt) : alt
    return type('Extra', {fields: {alt: altField}})
  }, [i18n])
  const node = useEditor().node
  return (
    <Surface className={styles.FileEditor.surface()}>
      <div className={styles.FileEditor({image: isImage})}>
        {isImage && (
          <FilePreview
            liveUrl={liveUrl ? String(liveUrl) : undefined}
            preview={preview}
            thumbBackground={thumbBackground}
            width={width}
            height={height}
            onHoverPointChange={setHoverPoint}
          />
        )}
        <div className={styles.FileEditor.content()}>
          <Surface variant="muted" className={styles.FileEditor.metadata()}>
            <dl className={styles.FileEditor.metadata.grid()}>
              <div className={styles.FileEditor.metadata.item()}>
                <dt className={styles.FileEditor.metadata.term()}>Extension</dt>
                <dd className={styles.FileEditor.metadata.value()}>
                  {extension}
                </dd>
              </div>
              <div className={styles.FileEditor.metadata.item()}>
                <dt className={styles.FileEditor.metadata.term()}>File size</dt>
                <dd className={styles.FileEditor.metadata.value()}>
                  {prettyBytes(size)}
                </dd>
              </div>
              {isImage && (
                <div className={styles.FileEditor.metadata.item()}>
                  <dt className={styles.FileEditor.metadata.term()}>
                    Dimensions
                  </dt>
                  <dd className={styles.FileEditor.metadata.value()}>
                    {width}px x {height}px
                  </dd>
                </div>
              )}
              {liveUrl && (
                <div className={styles.FileEditor.metadata.item({full: true})}>
                  <dt className={styles.FileEditor.metadata.term()}>URL</dt>
                  <dd className={styles.FileEditor.metadata.value()}>
                    {liveUrl.pathname}
                  </dd>
                </div>
              )}
            </dl>
          </Surface>
          {isImage && (
            <div className={styles.FileEditor.focus()}>
              <div className={styles.FileEditor.focus.header()}>
                <strong className={styles.FileEditor.focus.label()}>
                  Focus point
                </strong>
                <span className={styles.FileEditor.focus.description()}>
                  Click on the image to change the focus point
                </span>
              </div>
              <span className={styles.FileEditor.focus.value()}>
                ({displayedFocusPoint?.x.toFixed(2)},{' '}
                {displayedFocusPoint?.y.toFixed(2)})
              </span>
            </div>
          )}
          <div className={styles.FileEditor.fields()}>
            <FieldsEditor />
            <NodeEditor node={node} type={extra} />
          </div>
        </div>
      </div>
    </Surface>
  )
}
