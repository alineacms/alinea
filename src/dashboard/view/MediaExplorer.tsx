import {fromModule, HStack, TextLabel, VStack} from 'alinea/ui'
import {Main} from 'alinea/ui/Main'
import {useMemo} from 'react'
import {useQuery} from 'react-query'
//import {EntryProperty} from '../draft/EntryProperty.js'
//import {useCurrentDraft} from '../hook/UseCurrentDraft.js'
import {Entry} from 'alinea/core/Entry'
import {RootData} from 'alinea/core/Root'
import {workspaceMediaDir} from 'alinea/core/util/EntryFilenames'
import {EntryHeader} from 'alinea/dashboard/view/entry/EntryHeader'
import {IcRoundArrowBack} from 'alinea/ui/icons/IcRoundArrowBack'
import {useAtomValue} from 'jotai'
import {graphAtom} from '../atoms/DbAtoms.js'
import {EntryEditor} from '../atoms/EntryEditorAtoms.js'
import {useNavigate} from '../atoms/LocationAtoms.js'
import {useConfig} from '../hook/UseConfig.js'
import {useNav} from '../hook/UseNav.js'
import {useRoot} from '../hook/UseRoot.js'
import {useWorkspace} from '../hook/UseWorkspace.js'
import {Head} from '../util/Head.js'
import {Explorer} from './explorer/Explorer.js'
import {IconLink} from './IconButton.js'
import {FileUploader} from './media/FileUploader.js'
import css from './MediaExplorer.module.scss'

const styles = fromModule(css)

export interface MediaExplorerProps {
  editor?: EntryEditor
  root?: RootData
}

export function MediaExplorer({editor}: MediaExplorerProps) {
  const config = useConfig()
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
    ['explorer', 'media', 'total', condition],
    async () => {
      const cursor = Entry()
        .where(condition)
        .orderBy(Entry.type.desc(), Entry.entryId.desc())
      const info = await graph.preferDraft.maybeGet(
        Entry({entryId: parentId})
          .select({
            title: Entry.title,
            parent: Entry.parent
          })
          .maybeFirst()
      )
      return {...info, cursor}
    },
    {suspense: true, keepPreviousData: true}
  )
  const {cursor} = data!
  const title = data?.title || root.label
  const nav = useNav()
  const navigate = useNavigate()
  const backLink = data?.parent
    ? nav.entry({entryId: data.parent})
    : editor
    ? nav.root({root: root.name})
    : undefined
  return (
    <>
      <Main className={styles.root()} scrollable={false}>
        {editor && <EntryHeader editable={false} editor={editor} />}
        <div className={styles.root.inner()}>
          <HStack style={{flexGrow: 1, minHeight: 0}}>
            <VStack style={{height: '100%', width: '100%'}}>
              <header className={styles.root.inner.header()}>
                <Head>
                  <title>{String(title)}</title>
                </Head>
                <HStack center gap={18}>
                  {backLink && (
                    <IconLink icon={IcRoundArrowBack} href={backLink} />
                  )}
                  <h1 className={styles.root.title()}>
                    <TextLabel label={title} />
                  </h1>
                </HStack>
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
              root: root.name,
              directory: workspaceMediaDir(config, workspace.name)
            }}
          />
        </div>
      </Main>
    </>
  )
}
