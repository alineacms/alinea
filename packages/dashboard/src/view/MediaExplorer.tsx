import {Hub} from '@alinea/core/Hub'
import {Media} from '@alinea/core/Media'
import {Outcome} from '@alinea/core/Outcome'
import {InputForm} from '@alinea/editor'
import {Functions} from '@alinea/store'
import {fromModule, HStack, VStack} from '@alinea/ui'
import {Main} from '@alinea/ui/Main'
import useSize from '@react-hook/size'
import FastAverageColor from 'fast-average-color'
import {ChangeEvent, Suspense, useRef} from 'react'
import {useQuery, useQueryClient} from 'react-query'
import VirtualList from 'react-tiny-virtual-list'
import {EntryProperty} from '../draft/EntryProperty'
import {useCurrentDraft} from '../hook/UseCurrentDraft'
import {useSession} from '../hook/UseSession'
import {useWorkspace} from '../hook/UseWorkspace'
import {EditMode} from './entry/EditMode'
import {EntryHeader} from './entry/EntryHeader'
import {EntryTitle} from './entry/EntryTitle'
import {FileUploader} from './media/FileUploader'
import {MediaRow} from './media/MediaRow'
import css from './MediaExplorer.module.scss'

const styles = fromModule(css)

const resizeable = new Set(Media.imageExtensions)

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
  const isImage = resizeable.has('.' + extension!)
  if (isImage) {
    const {default: reduce} = await import('image-blob-reduce')
    const blob = await reduce().toBlob(file, {
      max: 160,
      unsharpAmount: 160,
      unsharpRadius: 0.6,
      unsharpThreshold: 1
    })
    preview = await blobUrl(blob)
    const fac = new FastAverageColor()
    const res = await fac.getColorAsync(preview)
    color = res.hex
  }
  const buffer = await file.arrayBuffer()
  return hub.uploadFile({
    workspace,
    root,
    path,
    buffer,
    preview,
    averageColor: color
  })
}

const scrollOffsets = new Map<string, number>()

export function MediaExplorer() {
  const queryClient = useQueryClient()
  const draft = useCurrentDraft()
  const {hub} = useSession()
  const {name: workspace} = useWorkspace()
  const {File} = Media
  const {data} = useQuery(
    ['media', 'total', draft.alinea.id],
    () => {
      return hub
        .query({
          cursor: File.where(File.alinea.parent.is(draft.alinea.id)).select({
            total: Functions.count()
          })
        })
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
          draft.alinea.root,
          draft.alinea.url + '/' + file.name,
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
    <Main className={styles.root()}>
      <EntryHeader mode={EditMode.Editing} />
      <div className={styles.root.inner()}>
        <HStack style={{flexGrow: 1, minHeight: 0}}>
          <FileUploader toggleSelect={() => {}} />
          <VStack style={{height: '100%', width: '100%'}}>
            <header className={styles.root.inner.header()}>
              <EntryTitle />
              {/* Todo: hide this in a tab interface */}
              <div style={{display: 'none'}}>
                <Suspense fallback={null}>
                  <InputForm state={EntryProperty.root} type={draft.channel} />
                </Suspense>
              </div>
            </header>
            <div
              ref={containerRef}
              style={{flexGrow: 1, minHeight: 0, overflow: 'hidden'}}
            >
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
                          parentId={draft.alinea.id}
                          from={from}
                          batchSize={perRow * 5}
                        />
                      </div>
                    )
                  }}
                  scrollOffset={scrollOffsets.get(draft.alinea.id) || 0}
                  onScroll={scrollTop => {
                    scrollOffsets.set(draft.alinea.id, scrollTop)
                  }}
                />
              )}
            </div>
          </VStack>
        </HStack>
      </div>
    </Main>
  )
}
