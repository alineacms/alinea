import {type} from '#/config.js'
import {
  DataList,
  DataListItem,
  DataListLabel,
  DataListValue,
  Icon,
  Link,
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
import {
  useEditor,
  useField,
  useFieldNode,
  useFieldOptions,
  useFieldValue
} from '#/dashboard/hooks.js'
import {IcRoundInfo, IcRoundInsertDriveFile} from '#/dashboard/icons.js'
import {styler} from '@alinea/styler'
import {useAtomValueRaw} from 'jotai'
import prettyBytes from 'pretty-bytes'
import {useMemo, useState} from 'react'
import {thumbHashToDataURL} from 'thumbhash'
import {NodeEditor} from '../NodeEditor.js'
import css from './FileEditor.module.css'
import {FilePreview, type FocusPoint} from './FilePreview.js'

const styles = styler(css)

const fileFields = type('File', {
  fields: {
    title: MediaFile.title,
    path: MediaFile.path,
    alt: MediaFile.alt
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
    <div className={styles.FileEditor()}>
      {Boolean(isImage || preview) && (
        <FilePreview
          // Only images load the file itself, a pdf shows its rendered page
          liveUrl={isImage ? liveUrl?.href : undefined}
          focusable={Boolean(isImage)}
          preview={preview}
          placeholder={placeholder}
          width={width}
          height={height}
          onHoverPointChange={setHoverPoint}
        />
      )}
      <Tabs defaultValue="file" className={styles.FileEditor.tabs()}>
        <TabsList
          aria-label="File editor"
          className={styles.FileEditor.tabs.list()}
        >
          <TabsTrigger value="file">
            <Icon icon={IcRoundInsertDriveFile} />
            File
          </TabsTrigger>
          <TabsTrigger value="details">
            <Icon icon={IcRoundInfo} />
            Details
          </TabsTrigger>
        </TabsList>
        <TabsContent value="file" className={styles.FileEditor.tabPanel()}>
          <NodeEditor node={node} type={fileFields} />
          <DataList aria-label="File details">
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
              <DataListItem>
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
            {isImage && (
              <DataListItem>
                <DataListLabel>Focus point</DataListLabel>
                <DataListValue className={styles.FileEditor.focus()}>
                  <span>
                    ({displayedFocusPoint.x.toFixed(2)},{' '}
                    {displayedFocusPoint.y.toFixed(2)})
                  </span>
                  <span className={styles.FileEditor.focus.hint()}>
                    Click on the image to change the focus point
                  </span>
                </DataListValue>
              </DataListItem>
            )}
          </DataList>
        </TabsContent>
        <TabsContent value="details" className={styles.FileEditor.tabPanel()}>
          <FileDetails />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/** Who created and last updated the file and when, and its URL aliases */
function FileDetails() {
  const options = useFieldOptions(MediaFile.metadata)
  const node = useFieldNode<object>(MediaFile.metadata)
  return (
    <NodeEditor node={node} readOnly={options.readOnly} type={options.fields} />
  )
}
