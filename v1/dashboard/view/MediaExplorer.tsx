//import {EntryProperty} from '../draft/EntryProperty.js'
//import {useCurrentDraft} from '../hook/UseCurrentDraft.js'
import styler from '@alinea/styler'
import {Entry} from '#/core/Entry.js'
import type {EntryFields} from '#/core/EntryFields.js'
import type {Filter} from '#/core/Filter.js'
import type {QueryWithResult} from '#/core/Graph.js'
import type {RootData} from '#/core/Root.js'
import {workspaceMediaDir} from '#/core/util/EntryFilenames.js'
import {EntryHeader} from '#/dashboard/view/entry/EntryHeader.js'
import {HStack, TextLabel, VStack} from '#/ui.js'
import {IcRoundArrowBack} from '#/ui/icons/IcRoundArrowBack.js'
import {Main} from '#/ui/Main.js'
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
