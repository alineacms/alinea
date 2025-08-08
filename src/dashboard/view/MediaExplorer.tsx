//import {EntryProperty} from '../draft/EntryProperty.js'
//import {useCurrentDraft} from '../hook/UseCurrentDraft.js'
import styler from '@alinea/styler'
import {Entry} from 'alinea/core/Entry'
import type {EntryFields} from 'alinea/core/EntryFields'
import type {Filter} from 'alinea/core/Filter'
import type {QueryWithResult} from 'alinea/core/Graph'
import type {RootData} from 'alinea/core/Root'
import {workspaceMediaDir} from 'alinea/core/util/EntryFilenames'
import {EntryHeader} from 'alinea/dashboard/view/entry/EntryHeader'
import {HStack, TextLabel, VStack} from 'alinea/ui'
import {IcRoundArrowBack} from 'alinea/ui/icons/IcRoundArrowBack'
import {Main} from 'alinea/ui/Main'
import {useMemo} from 'react'
import {useQuery} from 'react-query'
import type {EntryEditor} from '../atoms/EntryEditorAtoms.js'
import {useNavigate} from '../atoms/LocationAtoms.js'
import {useConfig} from '../hook/UseConfig.js'
import {useGraph} from '../hook/UseGraph.js'
import {useNav} from '../hook/UseNav.js'
import {useRoot} from '../hook/UseRoot.js'
import {useWorkspace} from '../hook/UseWorkspace.js'
import {Head} from '../util/Head.js'
import {Explorer, type ExporerItemSelect} from './explorer/Explorer.js'
import {IconLink} from './IconButton.js'
import css from './MediaExplorer.module.scss'
import {FileUploader} from './media/FileUploader.js'

const styles = styler(css)

export interface MediaExplorerProps {
  editor?: EntryEditor
  root?: RootData
}

export function MediaExplorer({editor}: MediaExplorerProps) {
  const config = useConfig()
  const parentId = editor?.entryId
  const workspace = useWorkspace()
  const root = useRoot()
  const graph = useGraph()
  const condition = useMemo((): Filter<EntryFields> => {
    return {
      _root: root.name,
      _workspace: workspace.name,
      _parentId: parentId ?? null
    }
  }, [workspace, root, parentId])
  const {data} = useQuery(
    ['explorer', 'media', 'total', condition],
    async () => {
      const query: QueryWithResult<ExporerItemSelect> = {
        select: undefined!,
        orderBy: [{desc: Entry.type}, {desc: Entry.id}],
        filter: condition
      }
      const info =
        parentId &&
        (await graph.first({
          select: {
            title: Entry.title,
            parent: Entry.parentId
          },
          id: parentId,
          status: 'preferDraft'
        }))
      return {...info, query}
    },
    {suspense: true, keepPreviousData: true}
  )
  const {query} = data!
  const title = data?.title || root.label
  const nav = useNav()
  const navigate = useNavigate()
  const backLink = data?.parent
    ? nav.entry({id: data.parent})
    : editor
      ? nav.root({root: root.name})
      : undefined
  return (
    <Main className={styles.root()} scrollable={false}>
      {editor && <EntryHeader editor={editor} />}
      <div className={styles.root.inner()}>
        <HStack style={{flexGrow: 1, minHeight: 0}}>
          <VStack style={{height: '100%', width: '100%'}}>
            <header className={styles.root.inner.header()}>
              <Head>
                <title>{`${workspace.label}: ${String(title)}`}</title>
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
              query={query}
              type="thumb"
              virtualized
              onNavigate={id => navigate(nav.entry({id: id}))}
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
  )
}
