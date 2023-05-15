import {Tree, UncontrolledTreeEnvironment} from 'react-complex-tree'
import {
  ENTRY_TREE_ROOT_KEY,
  EntryTreeItem,
  useEntryTreeProvider
} from '../atoms/EntryAtoms.js'
import {useNav} from '../hook/UseNav.js'
import {useNavigate} from '../util/HashRouter.js'
import './EntryTree.scss'

export function EntryTree() {
  const dataProvider = useEntryTreeProvider()
  const navigate = useNavigate()
  const nav = useNav()
  console.log(dataProvider)
  return (
    <div className="rct-dark" style={{height: '100%', overflow: 'auto'}}>
      <UncontrolledTreeEnvironment<EntryTreeItem>
        dataProvider={dataProvider}
        getItemTitle={item => item.data.title}
        viewState={{}}
        canDragAndDrop={true}
        canDropOnFolder={true}
        canReorderItems={true}
        onPrimaryAction={item => {
          navigate(nav.entry({id: item.data.entryId}))
        }}
      >
        <Tree treeId="entry-tree" rootItem={ENTRY_TREE_ROOT_KEY} />
      </UncontrolledTreeEnvironment>
    </div>
  )
}
