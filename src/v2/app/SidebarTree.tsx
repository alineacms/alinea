import {Tree, TreeItem} from '@alinea/components'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import {useMemo} from 'react'
import {Collection, ListLayout, Virtualizer} from 'react-aria-components'
import type {Selection} from 'react-aria-components'
import {cmsRouteAtom} from '../atoms/cms/route.js'
import {
  treeItemsAtom,
  treeExpandedKeysAtom,
  treeSelectedKeysAtom,
  type TreeItem as TreeItemData
} from '../atoms/cms/tree.js'
import {EntryStatus} from './EntryStatus.js'

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

const treeLayoutOptions = {
  rowHeight: 34,
  padding: 0,
  gap: 1
}

function addItemToMap(
  index: Map<string, TreeItemData>,
  item: TreeItemData
) {
  index.set(item.id, item)
  if (!item.children) return
  for (const child of item.children) {
    addItemToMap(index, child)
  }
}

export function SidebarTree() {
  const items = useAtomValue(treeItemsAtom)
  const [expandedKeys, setTreeExpandedKeys] = useAtom(treeExpandedKeysAtom)
  const [selectedKeys, setTreeSelectedKeys] = useAtom(treeSelectedKeysAtom)
  const setRoute = useSetAtom(cmsRouteAtom)
  const itemIndex = useMemo(() => {
    const index = new Map<string, TreeItemData>()
    for (const item of items) {
      addItemToMap(index, item)
    }
    return index
  }, [items])

  return (
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
        onAction={function onAction(key) {
          const id = String(key)
          const item = itemIndex.get(id)
          if (!item?.hasChildNodes) return
          const next = new Set(expandedKeys)
          if (next.has(id)) next.delete(id)
          else next.add(id)
          setTreeExpandedKeys(next)
        }}
        onExpandedChange={function onExpandedChange(keys) {
          setTreeExpandedKeys(toSet(keys, expandedKeys))
        }}
        onSelectionChange={function onSelectionChange(keys) {
          const selected = toSet(keys, selectedKeys)
          setTreeSelectedKeys(selected)
          const selectedId = selected.values().next().value
          if (!selectedId) return
          const item = itemIndex.get(String(selectedId))
          if (!item) return
          setRoute(() => {
            if (item.node.kind === 'root') {
              return {
                workspace: item.node.workspace,
                root: item.node.root
              }
            }
            return {
              workspace: item.node.workspace,
              root: item.node.root,
              entry: item.node.entryId
            }
          })
        }}
      >
        {renderTreeItem}
      </Tree>
    </Virtualizer>
  )
}
