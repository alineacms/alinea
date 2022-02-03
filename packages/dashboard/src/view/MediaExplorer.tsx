import {Hub} from '@alinea/core/Hub'
import {Media} from '@alinea/core/Media'
import {Outcome} from '@alinea/core/Outcome'
import {useCurrentDraft} from '@alinea/editor'
import {fromModule, Loader, px} from '@alinea/ui'
import {ChangeEvent, useRef} from 'react'
import {useQuery} from 'react-query'
import {useSession} from '../hook/UseSession'
import {EntryHeader} from './entry/EntryHeader'
import {EntryTitle} from './entry/EntryTitle'
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
  const {File} = Media
  const {data, isLoading} = useQuery(['media', draft.id], () => {
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
  })
  const inputRef = useRef<HTMLInputElement>(null)
  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = inputRef.current?.files?.[0]
    if (!file) return
    return uploadFile(hub, draft.url + '/' + file.name, file).then(console.log)
  }
  return (
    <>
      <EntryHeader />
      <div className={styles.root()}>
        <EntryTitle />

        {isLoading ? (
          <Loader absolute />
        ) : (
          <div>
            <div>
              <input ref={inputRef} type="file" onChange={handleFileUpload} />
            </div>
            {data?.map(file => {
              return (
                <div key={file.id} style={{padding: px(10)}}>
                  {file.preview && <img src={file.preview} />}
                  {file.title}
                  <div>Size: {file.size}</div>
                  <div>Extension: {file.extension}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
