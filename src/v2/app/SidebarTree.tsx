import {Button, Icon, Tree, TreeItem} from '@alinea/components'
import styler from '@alinea/styler'
import {getType} from 'alinea/core/Internal'
import {Root} from 'alinea/core/Root'
import {useAtomValue, useSetAtom} from 'jotai'
import {Collection, ListLayout, useDragAndDrop, Virtualizer} from 'react-aria-components'
import type {
  DragTypes,
  DropOperation,
  DropTarget,
  DroppableCollectionReorderEvent,
  Selection
} from 'react-aria-components'
import {configAtom} from '../atoms/config.js'
import type {CmsRoute} from '../atoms/cms/route.js'
import {cmsRouteAtom} from '../atoms/cms/route.js'
import {
  applyTreeRouteStateCommand,
  canDragTreeItem,
  focusTreeNodeCommand,
  focusTreeParentCommand,
  moveTreeNodeCommand,
  treeAtom,
  treeDropOperation,
  treeExpandedKeysAtom,
  treeSelectedKeysAtom,
  type TreeDropTarget,
  type TreeItem as TreeItemData
} from '../atoms/cms/tree.js'
import {
  IcRoundArrowBack,
  IcRoundDescription,
  IcTwotoneDescription,
  IcTwotoneFolder
} from '../icons.js'
import css from './SidebarTree.module.css'
import {EntryStatus} from './EntryStatus.js'
import {useMemo, useRef} from 'react'

const styles = styler(css)
const treeDragType = 'application/x-alinea-sidebar-tree-item'

interface DragInfo {
  keys: Set<string | number>
}

function toSet(keys: Selection, fallback: Set<string>): Set<string> {
  if (keys === 'all') return fallback
  return new Set(Array.from(keys, key => String(key)))
}

function entryStatusSuffix(item: TreeItemData) {
  const {node} = item
  if (node.kind !== 'entry' || !node.entryStatus) return undefined
  return (
    <EntryStatus
      status={node.entryStatus}
      isUnpublished={node.isUnpublished ?? false}
    />
  )
}

function navigateToTreeItem(
  setRoute: (update: CmsRoute | ((prev: CmsRoute) => CmsRoute)) => void,
  item: TreeItemData
) {
  setRoute(prev => {
    if (item.node.kind === 'root') {
      return {
        ...prev,
        workspace: item.node.workspace,
        root: item.node.root
      }
    }
    return {
      ...prev,
      workspace: item.node.workspace,
      root: item.node.root,
      entry: item.node.entryId
    }
  })
}

const treeLayoutOptions = {
  rowHeight: 34,
  padding: 0,
  gap: 1
}

export function SidebarTree() {
  const config = useAtomValue(configAtom)
  const {expandedKeys, selectedKeys, itemIndex, items, focusItem} =
    useAtomValue(treeAtom)
  const setTreeExpandedKeys = useSetAtom(treeExpandedKeysAtom)
  const setTreeSelectedKeys = useSetAtom(treeSelectedKeysAtom)
  const focusTreeNode = useSetAtom(focusTreeNodeCommand)
  const focusTreeParent = useSetAtom(focusTreeParentCommand)
  const applyTreeRouteState = useSetAtom(applyTreeRouteStateCommand)
  const moveTreeNode = useSetAtom(moveTreeNodeCommand)
  const setRoute = useSetAtom(cmsRouteAtom)
  const draggingNodeIdRef = useRef<string | null>(null)

  function treeItemIcon(item: TreeItemData) {
    if (item.node.kind === 'root') {
      const workspaceConfig = config.workspaces[item.node.workspace]
      const rootConfig = workspaceConfig?.[item.node.root]
      if (!rootConfig) return IcRoundDescription
      return Root.data(rootConfig).icon ?? IcRoundDescription
    }

    if (item.node.typeName) {
      const entryType = config.schema[item.node.typeName]
      if (entryType) {
        const icon = getType(entryType).icon
        if (icon) return icon
      }
    }
    if (item.node.isContainer) return IcTwotoneFolder
    return IcTwotoneDescription
  }

  function renderTreeItem(item: TreeItemData) {
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
  }

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

  return (
    <div className={styles.root()}>
      {focusItem && (
        <header className={styles.focusHeader()}>
          <Button
            aria-label="Back"
            size="icon"
            appearance="plain"
            className={styles.backButton()}
            onPress={function onPress() {
              focusTreeParent()
            }}
          >
            <Icon icon={IcRoundArrowBack} />
          </Button>
          <Button
            aria-label={`Go to ${focusItem.node.title}`}
            size="small"
            appearance="plain"
            className={styles.focusLabel()}
            onPress={function onPress() {
              navigateToTreeItem(setRoute, focusItem)
            }}
          >
            <Icon
              icon={treeItemIcon(focusItem)}
              className={styles.focusIcon()}
            />
            {focusItem.node.title}
          </Button>
        </header>
      )}
      <div className={styles.treeViewport()}>
        <Virtualizer
          layout={ListLayout}
          layoutOptions={treeLayoutOptions}
        >
          <Tree
            aria-label="Content tree"
            style={{display: 'block', padding: 0, height: '100%'}}
            items={items}
            dragAndDropHooks={dragAndDropHooks}
            selectionMode="single"
            selectionBehavior="replace"
            selectedKeys={selectedKeys}
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
            }}
          >
            {renderTreeItem}
          </Tree>
        </Virtualizer>
      </div>
    </div>
  )
}
