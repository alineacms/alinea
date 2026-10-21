import {type} from '#/config.js'
import {
  DataList,
  DataListItem,
  DataListLabel,
  DataListValue,
  Icon,
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
import {fileFieldKeys, type FileFields} from '#/core/media/MediaTypes.js'
import {Type} from '#/core/Type.js'
import {getType} from '#/core/Internal.js'
import {entries, fromEntries, keys, values} from '#/core/util/Objects.js'
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

export interface FileEditorProps {
  parentPaths: Array<string>
  workspace: string
}

export function FileEditor({parentPaths, workspace}: FileEditorProps) {
  const config = useAtomValueRaw(configAtom)
  const editor = useEditor()
  // Every file type has the fields of an upload
  const fields = Type.fields(editor.type) as unknown as FileFields
  const extraTabs = entries(Type.tabs(editor.type) ?? {})
  // The title and path, and the fields the file type adds outside its tabs
  const editable = useMemo(() => {
    const inTabs = new Set(
      values(Type.tabs(editor.type) ?? {}).flatMap(tab =>
        keys(Type.fields(tab))
      )
    )
    const added = entries(Type.fields(editor.type)).filter(
      ([key]) => !fileFieldKeys.has(key) && !inTabs.has(key)
    )
    return type('File', {
      fields: {title: fields.title, path: fields.path, ...fromEntries(added)}
    })
  }, [editor.type, fields])
  const path = useFieldValue(fields.path)
  const extension = useFieldValue(fields.extension)
  const isImage = isImageExtension(extension)
  const size = useFieldValue(fields.size)
  const width = useFieldValue(fields.width)
  const height = useFieldValue(fields.height)
  const preview = useFieldValue(fields.preview)
  const thumbHash = useFieldValue(fields.thumbHash)
  const placeholder = useMemo(() => {
    if (!thumbHash) return undefined
    return thumbHashToDataURL(base64.parse(thumbHash))
  }, [thumbHash])
  const [focusPoint = {x: 0.5, y: 0.5}] = useField(fields.focus)
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
  const node = editor.node
  return (
    <Surface className={styles.FileEditor.surface()}>
      <Tabs defaultValue="file" className={styles.FileEditor.tabs()}>
        <div className={styles.FileEditor.tabs.header()}>
          <TabsList aria-label="File editor">
            <TabsTrigger value="file">
              <Icon icon={IcRoundInsertDriveFile} />
              File
            </TabsTrigger>
            <TabsTrigger value="details">
              <Icon icon={IcRoundInfo} />
              Details
            </TabsTrigger>
            {extraTabs.map(([key, tab]) => {
              const {icon} = getType(tab)
              return (
                <TabsTrigger key={key} value={`tab-${key}`}>
                  {icon && <Icon icon={icon} />}
                  {Type.label(tab)}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </div>
        <TabsContent value="file" className={styles.FileEditor.tabPanel()}>
          <div className={styles.FileEditor.fields()}>
            <NodeEditor node={node} type={editable} />
          </div>
          <div className={styles.FileEditor()}>
            {isImage && (
              <FilePreview
                focus={fields.focus}
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
        <TabsContent value="details" className={styles.FileEditor.tabPanel()}>
          <div className={styles.FileEditor.details()}>
            <FileDetails metadata={fields.metadata} />
          </div>
        </TabsContent>
        {extraTabs.map(([key, tab]) => (
          <TabsContent
            key={key}
            value={`tab-${key}`}
            className={styles.FileEditor.tabPanel()}
          >
            <div className={styles.FileEditor.details()}>
              <NodeEditor node={node} type={tab} />
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </Surface>
  )
}

interface FileDetailsProps {
  metadata: FileFields['metadata']
}

/** Who created and last updated the file and when, and its URL aliases */
function FileDetails({metadata}: FileDetailsProps) {
  const options = useFieldOptions(metadata)
  const node = useFieldNode<object>(metadata)
  return (
    <NodeEditor node={node} readOnly={options.readOnly} type={options.fields} />
  )
}
