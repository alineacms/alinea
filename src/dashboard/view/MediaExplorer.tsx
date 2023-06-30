import {fromModule, HStack, TextLabel, Typo, VStack} from 'alinea/ui'
import {Main} from 'alinea/ui/Main'
import {useMemo} from 'react'
import {useQuery} from 'react-query'
//import {EntryProperty} from '../draft/EntryProperty.js'
//import {useCurrentDraft} from '../hook/UseCurrentDraft.js'
import {Entry, RootData} from 'alinea/core'
import {Expr} from 'alinea/core/pages/Expr'
import {useAtomValue} from 'jotai'
import {graphAtom} from '../atoms/EntryAtoms.js'
import {EntryEditor} from '../atoms/EntryEditor.js'
import {useRoot} from '../hook/UseRoot.js'
import {useWorkspace} from '../hook/UseWorkspace.js'
import {Head} from '../util/Head.js'
import {Explorer} from './explorer/Explorer.js'
import css from './MediaExplorer.module.scss'

const styles = fromModule(css)
const scrollOffsets = new Map<Expr<boolean>, number>()

export interface MediaExplorerProps {
  editor?: EntryEditor
  root?: RootData
}

export function MediaExplorer({editor}: MediaExplorerProps) {
  const parentId = editor?.entryId
  const workspace = useWorkspace()
  const root = useRoot()
  const graph = useAtomValue(graphAtom)
  const condition = useMemo(() => {
    return parentId
      ? Entry.parent.is(parentId)
      : Entry.root
          .is(root.name)
          .and(Entry.workspace.is(workspace.name))
          .and(Entry.parent.isNull())
  }, [workspace, root, parentId])
  const {data} = useQuery(
    ['media', 'total', condition],
    async () => {
      const cursor = Entry()
        .where(condition)
        .orderBy(Entry.type.desc(), Entry.entryId.desc())
      const info = await graph.active.get({
        title: Entry({entryId: parentId}).select(Entry.title).maybeFirst()
      })
      return {...info, cursor}
    },
    {suspense: true, keepPreviousData: true}
  )
  const {cursor} = data!
  const title = data?.title || root.label
  return (
    <Main className={styles.root()}>
      <div className={styles.root.inner()}>
        <HStack style={{flexGrow: 1, minHeight: 0}}>
          {/*<FileUploader toggleSelect={() => {}} />*/}
          <VStack style={{height: '100%', width: '100%'}}>
            <header className={styles.root.inner.header()}>
              <Head>
                <title>{String(title)}</title>
              </Head>
              <Typo.H1 flat style={{position: 'relative'}}>
                <TextLabel label={title} />
              </Typo.H1>
            </header>
            <Explorer cursor={cursor} type="thumb" virtualized />
            {/*<div
              ref={containerRef}
              style={{flexGrow: 1, minHeight: 0, overflow: 'hidden'}}
            >
              {containerHeight > 0 && (
                <VirtualList
                  className={styles.root.list()}
                  width="100%"
                  height={containerHeight}
                  itemCount={Math.ceil(files / perRow)}
                  itemSize={height}
                  renderItem={({index, style}) => {
                    const from = index * perRow
                    return (
                      <div key={index} style={{...style, height}}>
                        <MediaRow
                          amount={perRow}
                          condition={condition}
                          from={from}
                          batchSize={perRow * 5}
                        />
                      </div>
                    )
                  }}
                  scrollOffset={scrollOffsets.get(condition) || 0}
                  onScroll={scrollTop => {
                    scrollOffsets.set(condition, scrollTop)
                  }}
                />
              )}
            </div>*/}
          </VStack>
        </HStack>
      </div>
    </Main>
  )
}
