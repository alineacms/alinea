import {Tree, TreeItem} from '@alinea/components'
import {useAtom, useAtomValue} from 'jotai'
import type {Selection} from 'react-aria-components'
import {
  reactAriaTreeItemsAtom,
  treeBootstrapAtom,
  treeExpandedKeysAtom,
  treeSelectedKeysAtom,
  type ReactAriaTreeItem
} from '../atoms/cms/tree.js'

function toSet(keys: Selection, fallback: Set<string>): Set<string> {
  if (keys === 'all') return fallback
  return new Set(Array.from(keys, key => String(key)))
}

function renderTreeItem(item: ReactAriaTreeItem) {
  return (
    <TreeItem
      key={item.id}
      id={item.id}
      title={item.node.title}
      hasChildItems={item.hasChildNodes}
    >
      {item.children?.map(renderTreeItem)}
    </TreeItem>
  )
}

export function SidebarTree() {
  useAtomValue(treeBootstrapAtom)
  const items = useAtomValue(reactAriaTreeItemsAtom)
  const [expandedKeys, setTreeExpandedKeys] = useAtom(treeExpandedKeysAtom)
  const [selectedKeys, setTreeSelectedKeys] = useAtom(treeSelectedKeysAtom)

  return (
    <Tree
      aria-label="Content tree"
      selectionMode="single"
      selectionBehavior="replace"
      selectedKeys={selectedKeys}
      expandedKeys={expandedKeys}
      onExpandedChange={function onExpandedChange(keys) {
        setTreeExpandedKeys(toSet(keys, expandedKeys))
      }}
      onSelectionChange={function onSelectionChange(keys) {
        setTreeSelectedKeys(toSet(keys, selectedKeys))
      }}
    >
      {items.map(renderTreeItem)}
    </Tree>
  )
}
