import {type} from '#/config.js'
import {Surface, Tab, TabList, TabPanel, Tabs} from '#/components.js'
import {Config} from '#/core/Config.js'
import type {Entry} from '#/core/Entry.js'
import {isImage as isImageExtension} from '#/core/media/IsImage.js'
import {MediaLocation} from '#/core/media/MediaLocation.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import {outcome} from '#/core/Outcome.js'
import {base64} from '#/core/util/Encoding.js'
import {configAtom} from '#/dashboard/atoms/core.js'
import {useEditor, useField, useFieldValue} from '#/dashboard/hooks.js'
import {styler} from '@alinea/styler'
import {useAtomValue} from 'jotai'
import prettyBytes from 'pretty-bytes'
import {useMemo, useState} from 'react'
import {thumbHashToDataURL} from 'thumbhash'
import {NodeEditor} from '../EntryFields.js'
import css from './FileEditor.module.css'
import {FilePreview, type FocusPoint} from './FilePreview.js'

const styles = styler(css)

const metadataFields = type('Metadata', {
  fields: {
    title: MediaFile.title,
    path: MediaFile.path,
    alt: MediaFile.alt,
    metadata: MediaFile.metadata
  }
})

export interface FileEditorProps {
  entry: Pick<Entry, 'root' | 'url' | 'workspace'>
}

export function FileEditor({entry}: FileEditorProps) {
  const config = useAtomValue(configAtom)
  const location = useFieldValue(MediaFile.location)
  const path = useFieldValue(MediaFile.path)
  const extension = useFieldValue(MediaFile.extension)
  const isImage = isImageExtension(extension)
  const size = useFieldValue(MediaFile.size)
  const width = useFieldValue(MediaFile.width)
  const height = useFieldValue(MediaFile.height)
  const preview = useFieldValue(MediaFile.preview)
  const thumbHash = useFieldValue(MediaFile.thumbHash)
  const thumbBackground = useMemo(() => {
    if (!thumbHash) return undefined
    return `url(${thumbHashToDataURL(base64.parse(thumbHash))})`
  }, [thumbHash])
  const [focusPoint = {x: 0.5, y: 0.5}] = useField(MediaFile.focus)
  const [hoverPoint, setHoverPoint] = useState<FocusPoint | null>(null)
  const publicLocation = MediaLocation.publicUrl(config, {
    entryUrl: entry.url,
    extension,
    location,
    path,
    root: entry.root,
    workspace: entry.workspace
  })
  const baseUrl = Config.baseUrl(config) ?? window.location.href
  const [liveUrl] = outcome(() => new URL(publicLocation, baseUrl))
  const parsedBaseUrl = URL.parse(baseUrl)
  const displayedUrl = liveUrl
    ? parsedBaseUrl && liveUrl.origin === parsedBaseUrl.origin
      ? `${liveUrl.pathname}${liveUrl.search}${liveUrl.hash}`
      : liveUrl.href
    : undefined
  const displayedFocusPoint = hoverPoint ?? focusPoint
  const node = useEditor().node
  return (
    <Surface className={styles.FileEditor.surface()}>
      <Tabs className={styles.FileEditor.tabs()}>
        <div className={styles.FileEditor.tabs.header()}>
          <TabList aria-label="File editor">
            <Tab id="file">File</Tab>
            <Tab id="metadata">Metadata</Tab>
          </TabList>
        </div>
        <TabPanel id="file" className={styles.FileEditor.tabPanel()}>
          <div className={styles.FileEditor({image: isImage})}>
            {isImage && (
              <FilePreview
                liveUrl={liveUrl?.href}
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
                    <dt className={styles.FileEditor.metadata.term()}>
                      Extension
                    </dt>
                    <dd className={styles.FileEditor.metadata.value()}>
                      {extension}
                    </dd>
                  </div>
                  <div className={styles.FileEditor.metadata.item()}>
                    <dt className={styles.FileEditor.metadata.term()}>
                      File size
                    </dt>
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
                    <div
                      className={styles.FileEditor.metadata.item({full: true})}
                    >
                      <dt className={styles.FileEditor.metadata.term()}>URL</dt>
                      <dd
                        className={styles.FileEditor.metadata.value({
                          link: true
                        })}
                      >
                        <a
                          href={liveUrl.href}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {displayedUrl}
                        </a>
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
            </div>
          </div>
        </TabPanel>
        <TabPanel id="metadata" className={styles.FileEditor.tabPanel()}>
          <div className={styles.FileEditor.metadataPanel()}>
            <NodeEditor node={node} type={metadataFields} />
          </div>
        </TabPanel>
      </Tabs>
    </Surface>
  )
}
