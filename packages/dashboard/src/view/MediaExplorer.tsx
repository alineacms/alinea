import {Hub} from '@alinea/core/Hub'
import {Media} from '@alinea/core/Media'
import {Outcome} from '@alinea/core/Outcome'
import {Fields, useCurrentDraft} from '@alinea/editor'
import {fromModule, Typo} from '@alinea/ui'
import {Functions} from 'helder.store'
import {ChangeEvent, Suspense, useRef} from 'react'
import {useQuery} from 'react-query'
import VirtualList from 'react-tiny-virtual-list'
import {useSession} from '../hook/UseSession'
import {EntryHeader} from './entry/EntryHeader'
import {EntryTitle} from './entry/EntryTitle'
import {MediaRow} from './media/MediaRow'
import css from './MediaExplorer.module.scss'

const styles = fromModule(css)

const resizeable = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp'])

function blobUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, _) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.readAsDataURL(blob)
  })
}

async function uploadFile(hub: Hub, path: string, file: File) {
  let preview: string | undefined
  // If it's a known image file, let's try to create a thumbnail
  const extension = path.split('.').pop()
  const isImage = resizeable.has(extension!)
  if (isImage) {
    const {default: reduce} = await import('image-blob-reduce')
    const blob = await reduce().toBlob(file, {max: 100})
    preview = await blobUrl(blob)
  }
  const buffer = await file.arrayBuffer()
  return hub.uploadFile({path, buffer, preview})
}

export type MediaExplorerProps = {}

export function MediaExplorer({}: MediaExplorerProps) {
  const draft = useCurrentDraft()
  const {hub} = useSession()
  const type = hub.schema.type(draft.type)!
  const {File} = Media
  const {data} = useQuery(
    ['media:total', draft.id],
    () => {
      return hub
        .query(
          File.where(File.$parent.is(draft.id)).select({
            total: Functions.count()
          })
        )
        .then(Outcome.unpack)
    },
    {suspense: true}
  )
  /*const {data, isLoading} = useQuery(['media', draft.id], () => {
    return hub
      .query(
        File.where(File.$parent.is(draft.id)).select({
          id: File.id,
          title: File.title,
          extension: File.extension,
          size: File.size,
          preview: File.preview
        })
      )
      .then(Outcome.unpack)
  })*/
  const total = data![0].total
  const inputRef = useRef<HTMLInputElement>(null)
  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = inputRef.current?.files?.[0]
    if (!file) return
    return uploadFile(hub, draft.url + '/' + file.name, file).then(console.log)
  }
  const perRow = 4
  const height = 120
  return (
    <>
      <EntryHeader />
      <div className={styles.root()}>
        <EntryTitle>
          <Typo.Small>({total})</Typo.Small>
        </EntryTitle>

        <Suspense fallback={null}>
          <Fields type={type} />
        </Suspense>
        <div>
          <input ref={inputRef} type="file" onChange={handleFileUpload} />
        </div>
        <VirtualList
          width="100%"
          height={600}
          itemCount={Math.ceil(total / perRow)}
          itemSize={height}
          renderItem={({index, style}) => {
            const from = index * perRow
            const to = from + perRow
            return (
              <div key={index} style={{...style, height}}>
                <MediaRow parentId={draft.id} from={from} to={to} />
              </div>
            )
          }}
        />

        {/*isLoading ? (
          <Loader absolute />
        ) : (
          <div>
            <div>
              <input ref={inputRef} type="file" onChange={handleFileUpload} />
            </div>
            {data?.map(file => {
              return <MediaThumbnail key={file.id} file={file} />
            })}
          </div>
        )*/}
      </div>
    </>
  )
}
