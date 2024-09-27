import styler from '@alinea/styler'
import {resolveView} from 'alinea/core/View'
import {HStack, Icon, Loader} from 'alinea/ui'
import IcRoundAddCircle from 'alinea/ui/icons/IcRoundAddCircle'
import {EntryEditor} from '../atoms/EntryEditorAtoms.js'
import {useConfig} from '../hook/UseConfig.js'
import {useDashboard} from '../hook/UseDashboard.js'
import {useNav} from '../hook/UseNav.js'
import {useRoot} from '../hook/UseRoot.js'
import {useWorkspace} from '../hook/UseWorkspace.js'
import {useLocation, useNavigate} from '../util/HashRouter.js'
import {SuspenseBoundary} from '../util/SuspenseBoundary.js'
import {EntryEdit} from '../view/EntryEdit.js'
import {EntryTree} from '../view/EntryTree.js'
import {RootOverview} from '../view/RootOverview.js'
import {SearchBox} from '../view/SearchBox.js'
import {Sidebar} from '../view/Sidebar.js'
import {NewEntry} from '../view/entry/NewEntry.js'
import css from './ContentView.module.scss'

const styles = styler(css)

export interface ContentViewProps {
  editor?: EntryEditor
}

export function ContentView({editor}: ContentViewProps) {
  const {views} = useDashboard()
  const workspace = useWorkspace()
  const root = useRoot()
  const {search} = useLocation()
  const EntryView =
    (editor?.view ? resolveView(views, editor.view) : EntryEdit) ?? EntryEdit
  const RootView =
    (root?.view ? resolveView(views, root.view) : RootOverview) ?? RootOverview
  const nav = useNav()
  const navigate = useNavigate()
  const {schema} = useConfig()
  const type = editor && schema[editor.activeVersion.type]
  return (
    <>
      <Sidebar.Tree>
        <SearchBox />
        {/*<RootHeader active={!editor} />*/}
        <EntryTree
          i18nId={editor?.activeVersion.i18nId}
          selected={editor?.activeVersion.parents}
        />
        <div className={styles.root.create()}>
          <button
            className={styles.root.create.button()}
            onClick={() =>
              navigate(
                nav.create({
                  entryId: editor?.activeVersion.i18nId,
                  workspace: workspace.name,
                  root: root.name
                })
              )
            }
          >
            <HStack center gap={8} align="center">
              <Icon icon={IcRoundAddCircle} size={17} />
              <span>Create new</span>
            </HStack>
          </button>
        </div>
        {/*editor && <EntryVersionList editor={editor} />*/}
      </Sidebar.Tree>
      {search === '?new' && <NewEntry parentId={editor?.entryId} />}
      <SuspenseBoundary name="content view" fallback={<Loader absolute />}>
        {type && editor ? (
          <EntryView type={type} editor={editor} />
        ) : (
          <RootView root={root} />
        )}
      </SuspenseBoundary>
    </>
  )
}
