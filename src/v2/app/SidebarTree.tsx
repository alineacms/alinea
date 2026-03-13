import {Icon, Tree, TreeItem} from '@alinea/components'
import styler from '@alinea/styler'
import {useAtom, useAtomValue} from 'jotai'
import {memo, Suspense} from 'react'
import {
  Collection,
  ListLayout,
  useDragAndDrop,
  Virtualizer
} from 'react-aria-components'
import {
  Dashboard,
  DashboardRoot,
  DashboardTreeItem
} from '../dashboard/Dashboard.js'
import css from './SidebarTree.module.css'

const styles = styler(css)

interface SidebarTreeProps {
  dashboard: Dashboard
}

/*
const {dragAndDropHooks} = useDragAndDrop<TreeItemData>(
    useMemo(
      function createDragAndDropOptions() {
        return {
          getItems(_keys: Set<string | number>, items: Array<TreeItemData>) {
            return items
              .filter(item => canDragTreeItem(config, itemIndex, item.id))
              .map(item => ({
                [treeDragType]: item.id,
                'text/plain': item.node.title
              }))
          },
          onDragStart(event: DragInfo) {
            draggingNodeIdRef.current =
              Array.from(event.keys, key => String(key))[0] ?? null
          },
          onDragEnd() {
            draggingNodeIdRef.current = null
          },
          getDropOperation(
            target: DropTarget,
            types: DragTypes,
            _allowedOperations: Array<DropOperation>
          ) {
            if (target.type !== 'item') return 'cancel'
            if (!types.has(treeDragType)) return 'cancel'
            return treeDropOperation(config, itemIndex, draggingNodeIdRef.current, {
              key: String(target.key),
              dropPosition: target.dropPosition
            })
          },
          async onMove(event: DroppableCollectionReorderEvent) {
            const draggingNodeId = Array.from(event.keys, key => String(key))[0]
            if (!draggingNodeId) return
            const nextRoute = await moveTreeNode(draggingNodeId, {
              key: String(event.target.key),
              dropPosition: event.target.dropPosition
            })
            if (nextRoute) setRoute(nextRoute)
          }
        }
      },
      [config, itemIndex, moveTreeNode, setRoute]
    )
  )
*/

interface SidebarParentProps {
  root: DashboardRoot
}

function SidebarParent({root}: SidebarParentProps) {
  const label = useAtomValue(root.label)
  const icon = useAtomValue(root.icon)
  return (
    <header className={styles.focusHeader()}>
      <div className={styles.focusLabel()}>
        <Icon icon={icon} className={styles.focusIcon()} />
        {label}
      </div>
    </header>
  )
}

const SidebarItemChildren = memo(function SidebarItemChildren({
  item
}: {
  item: DashboardTreeItem
}) {
  const items = useAtomValue(item.items)
  return <Collection items={items}>{renderItem}</Collection>
})

const SidebarItem = memo(function SidebarItem({
  item
}: {
  item: DashboardTreeItem
}) {
  const label = useAtomValue(item.label)
  const isExpanded = useAtomValue(item.isExpanded)
  const hasChildItems = useAtomValue(item.hasChildren)
  let icon = useAtomValue(item.icon)
  return (
    <TreeItem
      id={item.id}
      textValue={label}
      title={label}
      hasChildItems={hasChildItems}
      icon={icon}
    >
      {isExpanded && (
        <Suspense>
          <SidebarItemChildren item={item} />
        </Suspense>
      )}
    </TreeItem>
  )
})

function renderItem(item: DashboardTreeItem) {
  return (
    <Suspense>
      <SidebarItem item={item} />
    </Suspense>
  )
}

const treeLayoutOptions = {
  rowHeight: 34,
  padding: 0,
  gap: 1
}

export function SidebarTree({dashboard}: SidebarTreeProps) {
  const workspace = useAtomValue(dashboard.currentWorkspace)
  const currentRoot = useAtomValue(workspace.tree.currentRoot)
  const [selectedKeys, setSelectedKeys] = useAtom(workspace.tree.selectedKeys)
  const [expandedKeys, setExpandedKeys] = useAtom(workspace.tree.expandedKeys)
  const items = useAtomValue(workspace.tree.items)
  const {dragAndDropHooks} = useDragAndDrop<DashboardTreeItem>({
    getItems(keys, values) {
      alert('ok')
      console.log({keys, values})
      return []
    }
  })
  return (
    <div className={styles.root()}>
      {currentRoot && <SidebarParent root={currentRoot} />}
      <div className={styles.treeViewport()}>
        <Suspense fallback="loading tree...">
          <Virtualizer layout={ListLayout} layoutOptions={treeLayoutOptions}>
            <Tree
              aria-label="Content tree"
              style={{display: 'block', padding: 0, height: '100%'}}
              items={items}
              dragAndDropHooks={dragAndDropHooks}
              selectionMode="single"
              selectionBehavior="replace"
              expandedKeys={expandedKeys}
              onExpandedChange={setExpandedKeys}
              selectedKeys={selectedKeys}
              onSelectionChange={setSelectedKeys}
            >
              {renderItem}
            </Tree>
          </Virtualizer>
        </Suspense>
      </div>
    </div>
  )
}
