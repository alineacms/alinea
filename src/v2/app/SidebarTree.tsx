import {Icon, Tree, TreeItem} from '@alinea/components'
import styler from '@alinea/styler'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import {unwrap} from 'jotai/utils'
import {memo, useMemo} from 'react'
import {
  Collection,
  ListLayout,
  useDragAndDrop,
  Virtualizer
} from 'react-aria-components'
import {IcTwotoneDescription, IcTwotoneFolder} from '../icons.js'
import {
  Dashboard,
  DashboardRoot,
  DashboardTreeItem
} from '../store/Dashboard.js'
import {LocaleMenu} from './LocaleMenu.js'
import css from './SidebarTree.module.css'

const styles = styler(css)

interface SidebarTreeProps {
  dashboard: Dashboard
}

interface SidebarParentProps {
  root: DashboardRoot
}

const SidebarParent = memo(function SidebarParent({root}: SidebarParentProps) {
  const label = useAtomValue(root.label)
  const icon = useAtomValue(root.icon)
  return (
    <header className={styles.focusHeader()}>
      <div className={styles.focusLabel()}>
        <Icon icon={icon} className={styles.focusIcon()} />
        {label}
        <LocaleMenu root={root} />
      </div>
    </header>
  )
})

interface SidebarItemChildrenProps {
  item: DashboardTreeItem
}

const SidebarItemChildren = memo(function SidebarItemChildren({
  item
}: SidebarItemChildrenProps) {
  const items = useAtomValue(item.items)
  return <Collection items={items}>{renderItem}</Collection>
})

interface SidebarItemProps {
  item: DashboardTreeItem
}

const SidebarItem = memo(function SidebarItem({item}: SidebarItemProps) {
  const label = useAtomValue(item.label)
  const isExpanded = useAtomValue(item.isExpanded)
  let icon = useAtomValue(item.icon)
  if (!icon) icon = item.hasChildren ? IcTwotoneFolder : IcTwotoneDescription
  return (
    <TreeItem
      id={item.id}
      textValue={label}
      title={label}
      hasChildItems={item.hasChildren}
      icon={icon}
    >
      {isExpanded && <SidebarItemChildren item={item} />}
    </TreeItem>
  )
})

function renderItem(item: DashboardTreeItem) {
  return <SidebarItem item={item} />
}

const treeLayoutOptions = {
  rowHeight: 34,
  padding: 0,
  gap: 1
}

export const SidebarTree = memo(function SidebarTree({
  dashboard
}: SidebarTreeProps) {
  const workspace = useAtomValue(dashboard.currentWorkspace)
  const currentRoot = useAtomValue(workspace.tree.currentRoot)
  const [selectedKeys, setSelectedKeys] = useAtom(workspace.tree.selectedKeys)
  const [expandedKeys, setExpandedKeys] = useAtom(workspace.tree.expandedKeys)
  const items = useAtomValue(unwrap(workspace.tree.items))
  const getItems = useSetAtom(workspace.tree.getItems)
  const onMove = useSetAtom(workspace.tree.onMove)
  const dnd = useMemo(() => ({getItems, onMove}), [getItems, onMove])
  const {dragAndDropHooks} = useDragAndDrop<DashboardTreeItem>(dnd)
  return (
    <div className={styles.root()}>
      {currentRoot && <SidebarParent root={currentRoot} />}
      <div className={styles.treeViewport()}>
        <Virtualizer layout={ListLayout} layoutOptions={treeLayoutOptions}>
          <Tree
            aria-label="Content tree"
            style={{display: 'block', padding: 0, height: '100%'}}
            items={items}
            dragAndDropHooks={dragAndDropHooks}
            selectionMode="single"
            selectionBehavior="replace"
            disallowEmptySelection
            expandedKeys={expandedKeys}
            onExpandedChange={setExpandedKeys}
            selectedKeys={selectedKeys}
            onSelectionChange={setSelectedKeys}
          >
            {renderItem}
          </Tree>
        </Virtualizer>
      </div>
    </div>
  )
})
