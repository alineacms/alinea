import {fromModule, HStack, TextLabel, VStack} from 'alinea/ui'
import {Main} from 'alinea/ui/Main'
import {useMemo} from 'react'
import {useQuery} from 'react-query'
//import {EntryProperty} from '../draft/EntryProperty.js'
//import {useCurrentDraft} from '../hook/UseCurrentDraft.js'
import {Entry, RootData} from 'alinea/core'
import {useAtomValue} from 'jotai'
import {graphAtom} from '../atoms/DbAtoms.js'
import {EntryEditor} from '../atoms/EntryEditor.js'
import {useNavigate} from '../atoms/LocationAtoms.js'
import {useNav} from '../hook/UseNav.js'
import {useRoot} from '../hook/UseRoot.js'
import {useWorkspace} from '../hook/UseWorkspace.js'
import {Head} from '../util/Head.js'
import {Explorer} from './explorer/Explorer.js'
import {FileUploader} from './media/FileUploader.js'
import css from './MediaExplorer.module.scss'

const styles = fromModule(css)

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
  const nav = useNav()
  const navigate = useNavigate()
  return (
    <>
      <Main className={styles.root()}>
        <Main.Container className={styles.root.inner()}>
          <HStack style={{flexGrow: 1, minHeight: 0}}>
            <VStack style={{height: '100%', width: '100%'}}>
              <header className={styles.root.inner.header()}>
                <Head>
                  <title>{String(title)}</title>
                </Head>
                <h1 className={styles.root.title()}>
                  <TextLabel label={title} />
                </h1>
              </header>
              <Explorer
                cursor={cursor}
                type="thumb"
                virtualized
                onNavigate={entryId => navigate(nav.entry({entryId: entryId}))}
              />
            </VStack>
          </HStack>
          <FileUploader
            destination={{
              parentId,
              workspace: workspace.name,
              root: root.name
            }}
          />
        </Main.Container>
      </Main>
    </>
  )
}
