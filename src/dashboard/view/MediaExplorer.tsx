import useSize from '@react-hook/size'
import {Outcome} from 'alinea/core/Outcome'
import {InputForm} from 'alinea/editor'
import {fromModule, HStack, VStack} from 'alinea/ui'
import {Main} from 'alinea/ui/Main'
import {Suspense, useRef} from 'react'
import {useQuery} from 'react-query'
import VirtualList from 'react-tiny-virtual-list'
//import {EntryProperty} from '../draft/EntryProperty.js'
//import {useCurrentDraft} from '../hook/UseCurrentDraft.js'
import {Media} from 'alinea/backend'
import {useSession} from '../hook/UseSession.js'
import {EditMode} from './entry/EditMode.js'
import {EntryHeader} from './entry/EntryHeader.js'
import {EntryTitle} from './entry/EntryTitle.js'
import {FileUploader} from './media/FileUploader.js'
import {MediaRow} from './media/MediaRow.js'
import css from './MediaExplorer.module.scss'

const styles = fromModule(css)
const scrollOffsets = new Map<string, number>()

export function MediaExplorer() {
  return <>todo</>
  const draft = useCurrentDraft()
  const {cnx: hub} = useSession()
  const {File} = Media
  const {data} = useQuery(
    ['media', 'total', draft.versionId],
    () => {
      return hub
        .query({
          cursor: File.where(File.alinea.parent.is(draft.versionId)).select({
            total: Functions.count()
          })
        })
        .then(Outcome.unpack)
    },
    {suspense: true}
  )
  const total = data![0].total
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
                          parentId={draft.versionId}
                          from={from}
                          batchSize={perRow * 5}
                        />
                      </div>
                    )
                  }}
                  scrollOffset={scrollOffsets.get(draft.versionId) || 0}
                  onScroll={scrollTop => {
                    scrollOffsets.set(draft.versionId, scrollTop)
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
