import {Button, Icon, Tree, TreeItem} from '@alinea/components'
import styler from '@alinea/styler'
import {useAtomValue, useSetAtom} from 'jotai'
import {Collection, ListLayout, Virtualizer} from 'react-aria-components'
import type {Selection} from 'react-aria-components'
import type {CmsRoute} from '../atoms/cms/route.js'
import {cmsRouteAtom} from '../atoms/cms/route.js'
import {
  applyTreeRouteStateCommand,
  focusTreeNodeCommand,
  focusTreeParentCommand,
  treeAtom,
  treeExpandedKeysAtom,
  treeSelectedKeysAtom,
  type TreeItem as TreeItemData
} from '../atoms/cms/tree.js'
import {IcRoundArrowBack} from '../icons.js'
import css from './SidebarTree.module.css'
import {EntryStatus} from './EntryStatus.js'

const styles = styler(css)

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

function renderTreeItem(item: TreeItemData) {
  return (
    <TreeItem
      key={item.id}
      id={item.id}
      title={item.node.title}
      hasChildItems={item.hasChildNodes}
      suffix={entryStatusSuffix(item)}
    >
      <Collection items={item.children}>
        {renderTreeItem}
      </Collection>
    </TreeItem>
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
  const {expandedKeys, selectedKeys, itemIndex, items, focusItem} =
    useAtomValue(treeAtom)
  const setTreeExpandedKeys = useSetAtom(treeExpandedKeysAtom)
  const setTreeSelectedKeys = useSetAtom(treeSelectedKeysAtom)
  const focusTreeNode = useSetAtom(focusTreeNodeCommand)
  const focusTreeParent = useSetAtom(focusTreeParentCommand)
  const applyTreeRouteState = useSetAtom(applyTreeRouteStateCommand)
  const setRoute = useSetAtom(cmsRouteAtom)

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
