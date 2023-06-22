import useSize from '@react-hook/size'
import {InputForm} from 'alinea/editor'
import {fromModule, HStack, VStack} from 'alinea/ui'
import {Main} from 'alinea/ui/Main'
import {Suspense, useRef} from 'react'
import {useQuery} from 'react-query'
import VirtualList from 'react-tiny-virtual-list'
//import {EntryProperty} from '../draft/EntryProperty.js'
//import {useCurrentDraft} from '../hook/UseCurrentDraft.js'
import {Entry} from 'alinea/core'
import {MediaFile} from 'alinea/core/media/MediaSchema'
import {useAtomValue} from 'jotai'
import {graphAtom} from '../atoms/EntryAtoms.js'
import {EntryHeader} from './entry/EntryHeader.js'
import {EntryTitle} from './entry/EntryTitle.js'
import {EntryEditProps} from './EntryEdit.js'
import {FileUploader} from './media/FileUploader.js'
import {MediaRow} from './media/MediaRow.js'
import css from './MediaExplorer.module.scss'

const styles = fromModule(css)
const scrollOffsets = new Map<string, number>()

export function MediaExplorer({editor}: EntryEditProps) {
  const graph = useAtomValue(graphAtom)
  const {data} = useQuery(
    ['media', 'total', editor.entryId],
    () => {
      return graph.active.count(
        MediaFile().where(Entry.parent.is(editor.entryId))
      )
    },
    {suspense: true}
  )
  const total = data || 0
  const containerRef = useRef(null)
  const [containerWidth, containerHeight] = useSize(containerRef)
  const perRow = Math.round(containerWidth / 240)
  const height = 200
  const selectedPhase = useAtomValue(editor.selectedPhase)
  const isActivePhase = editor.activePhase === selectedPhase
  const state = isActivePhase ? editor.draftState : editor.states[selectedPhase]
  return (
    <Main className={styles.root()}>
      <EntryHeader editor={editor} />
      <div className={styles.root.inner()}>
        <HStack style={{flexGrow: 1, minHeight: 0}}>
          <FileUploader toggleSelect={() => {}} />
          <VStack style={{height: '100%', width: '100%'}}>
            <header className={styles.root.inner.header()}>
              <EntryTitle editor={editor} />
              {/* Todo: hide this in a tab interface */}
              <div style={{display: 'none'}}>
                <Suspense fallback={null}>
                  <InputForm type={editor.type} state={state} />
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
                          parentId={editor.entryId}
                          from={from}
                          batchSize={perRow * 5}
                        />
                      </div>
                    )
                  }}
                  scrollOffset={scrollOffsets.get(editor.entryId) || 0}
                  onScroll={scrollTop => {
                    scrollOffsets.set(editor.entryId, scrollTop)
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
