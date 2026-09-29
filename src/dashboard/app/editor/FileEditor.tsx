import {type} from '#/config.js'
import {
  DataList,
  DataListItem,
  DataListLabel,
  DataListValue,
  Link,
  Surface,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '#/components.js'
import {Config} from '#/core/Config.js'
import {isImage as isImageExtension} from '#/core/media/IsImage.js'
import {MediaLocation} from '#/core/media/MediaLocation.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import {base64} from '#/core/util/Encoding.js'
import {configAtom} from '#/dashboard/atoms/core.js'
import {useEditor, useField, useFieldValue} from '#/dashboard/hooks.js'
import {styler} from '@alinea/styler'
import {useAtomValueRaw} from 'jotai'
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
  parentPaths: Array<string>
  workspace: string
}

export function FileEditor({parentPaths, workspace}: FileEditorProps) {
  const config = useAtomValueRaw(configAtom)
  const path = useFieldValue(MediaFile.path)
  const extension = useFieldValue(MediaFile.extension)
  const isImage = isImageExtension(extension)
  const size = useFieldValue(MediaFile.size)
  const width = useFieldValue(MediaFile.width)
  const height = useFieldValue(MediaFile.height)
  const preview = useFieldValue(MediaFile.preview)
  const thumbHash = useFieldValue(MediaFile.thumbHash)
  const placeholder = useMemo(() => {
    if (!thumbHash) return undefined
    return thumbHashToDataURL(base64.parse(thumbHash))
  }, [thumbHash])
  const [focusPoint = {x: 0.5, y: 0.5}] = useField(MediaFile.focus)
  const [hoverPoint, setHoverPoint] = useState<FocusPoint | null>(null)
  const publicLocation = MediaLocation.publicUrl(config, {
    extension,
    parentPaths,
    path,
    workspace
  })
  const baseUrl = Config.baseUrl(config) ?? window.location.href
  const liveUrl = URL.parse(publicLocation, baseUrl)
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
      <Tabs defaultValue="file" className={styles.FileEditor.tabs()}>
        <div className={styles.FileEditor.tabs.header()}>
          <TabsList aria-label="File editor">
            <TabsTrigger value="file">File</TabsTrigger>
            <TabsTrigger value="metadata">Metadata</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="file" className={styles.FileEditor.tabPanel()}>
          <div className={styles.FileEditor({image: isImage})}>
            {isImage && (
              <FilePreview
                liveUrl={liveUrl?.href}
                preview={preview}
                placeholder={placeholder}
                width={width}
                height={height}
                onHoverPointChange={setHoverPoint}
              />
            )}
            <div className={styles.FileEditor.content()}>
              <Surface variant="muted" className={styles.FileEditor.metadata()}>
                <DataList orientation="vertical" aria-label="File details">
                  <DataListItem>
                    <DataListLabel>Extension</DataListLabel>
                    <DataListValue>{extension}</DataListValue>
                  </DataListItem>
                  <DataListItem>
                    <DataListLabel>File size</DataListLabel>
                    <DataListValue>{prettyBytes(size)}</DataListValue>
                  </DataListItem>
                  {isImage && width && height ? (
                    <DataListItem>
                      <DataListLabel>Dimensions</DataListLabel>
                      <DataListValue>
                        {width}px x {height}px
                      </DataListValue>
                    </DataListItem>
                  ) : null}
                  {liveUrl && (
                    <DataListItem full>
                      <DataListLabel>URL</DataListLabel>
                      <DataListValue>
                        <Link
                          href={liveUrl.href}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {displayedUrl}
                        </Link>
                      </DataListValue>
                    </DataListItem>
                  )}
                </DataList>
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
        </TabsContent>
        <TabsContent value="metadata" className={styles.FileEditor.tabPanel()}>
          <div className={styles.FileEditor.metadataPanel()}>
            <NodeEditor node={node} type={metadataFields} />
          </div>
        </TabsContent>
      </Tabs>
    </Surface>
  )
}
