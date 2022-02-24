import {Hub} from '@alinea/core/Hub'
import {Media} from '@alinea/core/Media'
import {Outcome} from '@alinea/core/Outcome'
import {Functions} from '@alinea/store'
import {fromModule} from '@alinea/ui'
import useSize from '@react-hook/size'
import FastAverageColor from 'fast-average-color'
import {ChangeEvent, useRef} from 'react'
import {useQuery, useQueryClient} from 'react-query'
import VirtualList from 'react-tiny-virtual-list'
import {useCurrentDraft} from '../hook/UseCurrentDraft'
import {useSession} from '../hook/UseSession'
import {useWorkspace} from '../hook/UseWorkspace'
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

async function uploadFile(
  hub: Hub,
  workspace: string,
  root: string,
  path: string,
  file: File
) {
  let preview: string | undefined, color: string | undefined
  // If it's a known image file, let's try to create a thumbnail
  const extension = path.split('.').pop()
  const isImage = resizeable.has(extension!)
  if (isImage) {
    const {default: reduce} = await import('image-blob-reduce')
    const blob = await reduce().toBlob(file, {max: 160})
    preview = await blobUrl(blob)
    const fac = new FastAverageColor()
    const res = await fac.getColorAsync(preview)
    color = res.hex
  }
  const buffer = await file.arrayBuffer()
  return hub.uploadFile(workspace, root, {path, buffer, preview, color})
}

const scrollOffsets = new Map<string, number>()

export function MediaExplorer() {
  const queryClient = useQueryClient()
  const draft = useCurrentDraft()
  const {hub} = useSession()
  const {workspace} = useWorkspace()
  const {File} = Media
  const {data} = useQuery(
    ['media', 'total', draft.id],
    () => {
      return hub
        .query(
          File.where(File.parent.is(draft.id)).select({
            total: Functions.count()
          })
        )
        .then(Outcome.unpack)
    },
    {suspense: true}
  )
  const total = data![0].total
  const inputRef = useRef<HTMLInputElement>(null)
  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = inputRef.current?.files
    if (!files) return
    return Promise.all(
      Array.from(files).map(file =>
        uploadFile(
          hub,
          workspace,
          draft.root,
          draft.url + '/' + file.name,
          file
        ).then(console.log)
      )
    ).then(() => {
      queryClient.invalidateQueries(['media'])
    })
  }
  const containerRef = useRef(null)
  const [containerWidth, containerHeight] = useSize(containerRef)
  const perRow = Math.round(containerWidth / 240)
  const height = 200
  return (
    <div className={styles.root()}>
      <EntryHeader />
      <div className={styles.root.inner()}>
        <header className={styles.root.inner.header()}>
          <EntryTitle />

          {/*<Suspense fallback={null}>
            <Fields type={type} />
          </Suspense>*/}
          <div>
            <input
              ref={inputRef}
              type="file"
              multiple
              onChange={handleFileUpload}
            />
          </div>
        </header>
        <div ref={containerRef} style={{flexGrow: 1, overflow: 'hidden'}}>
          {containerHeight > 0 && (
            <VirtualList
              className={styles.root.list()}
              width="100%"
              height={containerHeight}
              itemCount={Math.ceil(total / perRow)}
              itemSize={height}
              renderItem={({index, style}) => {
                const from = index * perRow
                return (
                  <div key={index} style={{...style, height}}>
                    <MediaRow
                      amount={perRow}
                      parentId={draft.id}
                      from={from}
                      batchSize={perRow * 5}
                    />
                  </div>
                )
              }}
              scrollOffset={scrollOffsets.get(draft.id) || 0}
              onScroll={scrollTop => {
                scrollOffsets.set(draft.id, scrollTop)
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
