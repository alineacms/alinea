import {Button, Loader, fromModule} from 'alinea/ui'
import IcRoundAddCircle from 'alinea/ui/icons/IcRoundAddCircle'
import {Suspense} from 'react'
import {EntryEditor} from '../atoms/EntryEditor.js'
import {useNav} from '../hook/UseNav.js'
import {useRoot} from '../hook/UseRoot.js'
import {useWorkspace} from '../hook/UseWorkspace.js'
import {useLocation, useNavigate} from '../util/HashRouter'
import {EntryEdit} from '../view/EntryEdit.js'
import {EntryTree} from '../view/EntryTree.js'
import {RootOverview} from '../view/RootOverview.js'
import {SearchBox} from '../view/SearchBox.js'
import {Sidebar} from '../view/Sidebar.js'
import {EntryVersionList} from '../view/entry/EntryVersionList.js'
import {NewEntry} from '../view/entry/NewEntry.js'
import {RootHeader} from '../view/entry/RootHeader.js'
import css from './ContentView.module.scss'

const styles = fromModule(css)

export interface ContentViewProps {
  editor?: EntryEditor
}

export function ContentView({editor}: ContentViewProps) {
  const workspace = useWorkspace()
  const root = useRoot()
  const {search} = useLocation()
  const View = editor?.view ?? EntryEdit
  const nav = useNav()
  const navigate = useNavigate()
  return (
    <>
      <Sidebar.Tree>
        <SearchBox />
        <RootHeader active={!editor} />
        <EntryTree
          entryId={editor?.entryId}
          selected={editor?.version.parents}
        />
        <div className={styles.root.create()}>
          <Button
            icon={IcRoundAddCircle}
            onClick={() =>
              navigate(
                nav.create({
                  entryId: editor?.entryId,
                  workspace: workspace.name,
                  root: root.name
                })
              )
            }
          >
            Create new page
          </Button>
        </div>
        {editor && <EntryVersionList editor={editor} />}
      </Sidebar.Tree>
      {search === '?new' && (
        <Suspense fallback={<Loader absolute />}>
          <NewEntry parentId={editor?.entryId} />
        </Suspense>
      )}
      <Suspense fallback={<Loader absolute />}>
        {editor ? (
          <View editor={editor} />
        ) : (
          <RootOverview workspace={workspace} root={root} />
        )}
      </Suspense>
    </>
  )
}
