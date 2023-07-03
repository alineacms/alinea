import {EntryPhase, Type} from 'alinea/core'
import {Icon, px} from 'alinea/ui'
import {IcOutlineInsertDriveFile} from 'alinea/ui/icons/IcOutlineInsertDriveFile'
import {IcRoundEdit} from 'alinea/ui/icons/IcRoundEdit'
import {IcRoundKeyboardArrowDown} from 'alinea/ui/icons/IcRoundKeyboardArrowDown'
import {IcRoundKeyboardArrowRight} from 'alinea/ui/icons/IcRoundKeyboardArrowRight'
import {Tree, UncontrolledTreeEnvironment} from 'react-complex-tree'
import {
  ENTRY_TREE_ROOT_KEY,
  EntryTreeItem,
  useEntryTreeProvider
} from '../atoms/EntryAtoms.js'
import {useConfig} from '../hook/UseConfig.js'
import {useNav} from '../hook/UseNav.js'
import {useNavigate} from '../util/HashRouter.js'
import './EntryTree.scss'

export interface EntryTreeProps {
  entryId?: string
  selected?: Array<string>
}

// Todo: convert to controlled & virtualize (lukasbach/react-complex-tree#263)

export function EntryTree({entryId, selected = []}: EntryTreeProps) {
  const {schema} = useConfig()
  const dataProvider = useEntryTreeProvider()
  const navigate = useNavigate()
  const nav = useNav()
  return (
    <div className="rct-dark" style={{flexGrow: 1, overflow: 'auto'}}>
      <UncontrolledTreeEnvironment<EntryTreeItem>
        dataProvider={dataProvider}
        getItemTitle={item => item.data.title}
        canDragAndDrop={true}
        canDropOnFolder={true}
        canReorderItems={true}
        renderItemArrow={({context, item, info}) => {
          const hasChildren = Boolean(item.children?.length)
          if (!hasChildren) return null
          const {isExpanded} = context
          return (
            <span className="rct-tree-item-arrow">
              {isExpanded ? (
                <IcRoundKeyboardArrowDown style={{fontSize: px(20)}} />
              ) : (
                <IcRoundKeyboardArrowRight style={{fontSize: px(20)}} />
              )}
            </span>
          )
        }}
        renderItemTitle={({title, item}) => {
          const hasChildren = Boolean(item.children?.length)
          const {icon} = Type.meta(schema[item.data.type])
          const isDraft = item.data.phase === EntryPhase.Draft
          return (
            <>
              {!hasChildren && (
                <span className="rct-tree-item-icon">
                  <Icon icon={icon || IcOutlineInsertDriveFile} />
                </span>
              )}

              <span className="rct-tree-item-title">{title}</span>

              {isDraft && (
                <span className="rct-tree-item-status">
                  <IcRoundEdit />
                </span>
              )}
            </>
          )
        }}
        onPrimaryAction={item => {
          navigate(nav.entry({entryId: item.data.entryId}))
        }}
        onExpandItem={item => {
          navigate(nav.entry({entryId: item.data.entryId}))
        }}
        onCollapseItem={item => {
          navigate(nav.entry({entryId: item.data.entryId}))
        }}
        viewState={{
          ['entry-tree']: {
            selectedItems: entryId ? [entryId] : [],
            expandedItems: selected
          }
        }}
      >
        <Tree treeId="entry-tree" rootItem={ENTRY_TREE_ROOT_KEY} />
      </UncontrolledTreeEnvironment>
    </div>
  )
}
