import {Button, Icon, Tree, TreeItem} from '@alinea/components'
import styler from '@alinea/styler'
import {useAtomValue} from 'jotai'
import {ListLayout, Virtualizer} from 'react-aria-components'
import {Dashboard, DashboardTreeItem} from '../dashboard/Dashboard.js'
import {IcRoundArrowBack} from '../icons.js'
import css from './SidebarTree.module.css'

const styles = styler(css)

interface SidebarTreeProps {
  dashboard: Dashboard
}

/*function renderTreeItem(item: TreeItemData) {
  const isDraggable = canDragTreeItem(config, itemIndex, item.id)
  return (
    <TreeItem
      key={item.id}
      id={item.id}
      title={item.node.title}
      icon={treeItemIcon(item)}
      className={!isDraggable ? css.dragDisabled : undefined}
      hasChildItems={item.hasChildNodes}
      suffix={entryStatusSuffix(item)}
    >
      <Collection items={item.children}>
        {renderTreeItem}
      </Collection>
    </TreeItem>
  )
}*/

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
  item: DashboardTreeItem
}

function SidebarParent({item}: SidebarParentProps) {
  const label = useAtomValue(item.label)
  const icon = useAtomValue(item.icon)
  return (
    <header className={styles.focusHeader()}>
      <Button
        aria-label="Back"
        size="icon"
        appearance="plain"
        className={styles.backButton()}
        onPress={() => alert('todo: go to parent')}
      >
        <Icon icon={IcRoundArrowBack} />
      </Button>
      <Button
        aria-label={`Go to ${label}`}
        size="small"
        appearance="plain"
        className={styles.focusLabel()}
        onPress={() => alert('todo: go to item')}
      >
        <Icon icon={icon} className={styles.focusIcon()} />
        {label}
      </Button>
    </header>
  )
}

function SidebarItem({item}: {item: DashboardTreeItem}) {
  const label = useAtomValue(item.label)
  return (
    <TreeItem id={item.id} textValue={label} title={label}>
      {label}
    </TreeItem>
  )
}

const treeLayoutOptions = {
  rowHeight: 34,
  padding: 0,
  gap: 1
}

export function SidebarTree({dashboard}: SidebarTreeProps) {
  const workspace = useAtomValue(dashboard.currentWorkspace)
  const focusItem = useAtomValue(workspace.tree.focusItem)
  const items = useAtomValue(workspace.tree.items)
  console.log(items)
  return (
    <div className={styles.root()}>
      {focusItem && <SidebarParent item={focusItem} />}
      <div className={styles.treeViewport()}>
        <Virtualizer layout={ListLayout} layoutOptions={treeLayoutOptions}>
          <Tree
            aria-label="Content tree"
            style={{display: 'block', padding: 0, height: '100%'}}
            items={items}
            //dragAndDropHooks={dragAndDropHooks}
            selectionMode="single"
            selectionBehavior="replace"
            onAction={console.log}
            /*selectedKeys={selectedKeys}
            expandedKeys={expandedKeys}
            onAction={async function onAction(key) {
              const item = itemIndex.get(String(key))
              if (!item?.hasChildNodes) return
              await focusTreeNode(item.id)
            }}
            onExpandedChange={async function onExpandedChange(keys) {
              await setTreeExpandedKeys(toSet(keys, expandedKeys))
            }}
            onSelectionChange={async function onSelectionChange(keys) {
              const selected = toSet(keys, selectedKeys)
              setTreeSelectedKeys(selected)
              const selectedId = selected.values().next().value
              if (!selectedId) return
              const item = itemIndex.get(String(selectedId))
              if (!item) return
              if (item.hasChildNodes) await focusTreeNode(item.id)
              navigateToTreeItem(setRoute, item)
              await applyTreeRouteState({
                workspace: item.node.workspace,
                root: item.node.root,
                entry: item.node.entryId
              })
            }}*/
          >
            {item => <SidebarItem key={item.id} item={item} />}
          </Tree>
        </Virtualizer>
      </div>
    </div>
  )
}
