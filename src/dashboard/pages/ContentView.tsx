import {Loader} from 'alinea/ui'
import {Suspense} from 'react'
import {EntryEditor} from '../atoms/EntryEditor.js'
import {useRoot} from '../hook/UseRoot.js'
import {useWorkspace} from '../hook/UseWorkspace.js'
import {useLocation} from '../util/HashRouter'
import {EntryEdit} from '../view/EntryEdit.js'
import {EntryTree} from '../view/EntryTree.js'
import {RootOverview} from '../view/RootOverview.js'
import {SearchBox} from '../view/SearchBox.js'
import {Sidebar} from '../view/Sidebar.js'
import {EntryVersionList} from '../view/entry/EntryVersionList.js'
import {NewEntry} from '../view/entry/NewEntry.js'
import {RootHeader} from '../view/entry/RootHeader.js'

export interface ContentViewProps {
  editor?: EntryEditor
}

export function ContentView({editor}: ContentViewProps) {
  const workspace = useWorkspace()
  const root = useRoot()
  const {search} = useLocation()
  return (
    <>
      <Sidebar.Tree>
        <SearchBox />
        <RootHeader />
        <EntryTree
          entryId={editor?.entryId}
          selected={editor?.version.parents}
        />
        {editor && <EntryVersionList editor={editor} />}
      </Sidebar.Tree>
      {search === '?new' && (
        <Suspense fallback={<Loader absolute />}>
          <NewEntry parentId={editor?.entryId} />
        </Suspense>
      )}
      <Suspense fallback={<Loader absolute />}>
        {editor ? (
          <EntryEdit editor={editor} />
        ) : (
          <RootOverview workspace={workspace} root={root} />
        )}
      </Suspense>
    </>
  )
}
