import {Button, Icon, Menu, MenuItem, Tree, TreeItem} from '@alinea/components'
import styler from '@alinea/styler'
import {assert} from 'alinea/core/util/Assert'
import {useAtom, useAtomValue, useSetAtom, useStore} from 'jotai'
import {unwrap} from 'jotai/utils'
import {memo, Suspense, useMemo, useState} from 'react'
import {
  Collection,
  DialogTrigger,
  ListLayout,
  useDragAndDrop,
  Virtualizer
} from 'react-aria-components'
import {
  IcRoundAdd,
  IcRoundKeyboardTab,
  IcTwotoneDescription,
  IcTwotoneFolder
} from '../icons.js'
import {
  Dashboard,
  DashboardRoot,
  DashboardTreeItem
} from '../store/Dashboard.js'
import {LocaleMenu} from './LocaleMenu.js'
import {CreateEntry} from './modals/CreateEntry.js'
import css from './SidebarTree.module.css'
import {Sheet} from './ui/Sheet.js'
import {SidebarBody, SidebarHeader} from './ui/Sidebar.js'

const styles = styler(css)

interface SidebarTreeProps {
  dashboard: Dashboard
}

interface SidebarParentProps {
  root: DashboardRoot
  roots: Array<DashboardRoot>
  isTreeCollapsed: boolean
  onToggleTreeCollapsed: () => void
  onRootSelect: (root: DashboardRoot) => void
}

const SidebarParent = memo(function SidebarParent({
  root,
  roots,
  isTreeCollapsed,
  onToggleTreeCollapsed,
  onRootSelect
}: SidebarParentProps) {
  const label = useAtomValue(root.label)
  return (
    <SidebarHeader>
      <div className={styles.focusLabel()}>
        <Button
          size="icon"
          appearance="outline"
          icon={IcRoundKeyboardTab}
          style={isTreeCollapsed ? undefined : {rotate: '180deg'}}
          aria-label={isTreeCollapsed ? 'Expand tree' : 'Collapse tree'}
          onPress={onToggleTreeCollapsed}
        />
        <Menu
          label={
            <Button
              appearance="plain"
              intent="secondary"
              className={styles.rootsTrigger()}
            >
              {label}
            </Button>
          }
          aria-label={label}
          selectionMode="single"
        >
          {roots.map(root => (
            <RootMenuItem
              key={root.key}
              root={root}
              onRootSelect={onRootSelect}
            />
          ))}
        </Menu>
        <LocaleMenu root={root} />
        <DialogTrigger>
          <Button size="icon" appearance="outline" icon={IcRoundAdd} />
          <Sheet>
            <CreateEntry />
          </Sheet>
        </DialogTrigger>
      </div>
    </SidebarHeader>
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
  const children = useMemo(() => {
    return (
      isExpanded && (
        <Suspense>
          <SidebarItemChildren item={item} />
        </Suspense>
      )
    )
  }, [isExpanded, item])
  return (
    <TreeItem
      id={item.id}
      textValue={label}
      title={label}
      hasChildItems={item.hasChildren}
      icon={icon}
    >
      {children}
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

interface RootButtonProps {
  root: DashboardRoot
  expanded?: boolean
  onRootSelect: (root: DashboardRoot) => void
}

function RootButton({
  root,
  expanded = false,
  onRootSelect
}: RootButtonProps) {
  const icon = useAtomValue(root.icon)
  const label = useAtomValue(root.label)
  const selected = useAtomValue(root.selected)
  return (
    <Button
      size="square-petite"
      appearance={selected ? 'active' : 'plain'}
      className={styles.rootButton()}
      data-expanded={expanded || undefined}
      aria-label={label}
      onPress={() => onRootSelect(root)}
    >
      {icon && <Icon icon={icon} data-slot="icon" />}
      {expanded && <span className={styles.rootButtonLabel()}>{label}</span>}
    </Button>
  )
}

interface RootMenuItemProps {
  root: DashboardRoot
  onRootSelect: (root: DashboardRoot) => void
}

function RootMenuItem({root, onRootSelect}: RootMenuItemProps) {
  const label = useAtomValue(root.label)
  return (
    <MenuItem
      key={root.key}
      id={root.key}
      onAction={() => onRootSelect(root)}
      className={styles.rootButton()}
    >
      {label}
    </MenuItem>
  )
}

export const SidebarTree = memo(function SidebarTree({
  dashboard
}: SidebarTreeProps) {
  const store = useStore()
  const workspace = useAtomValue(dashboard.currentWorkspace)
  assert(workspace, 'No workspace selected')
  const currentRoot = useAtomValue(dashboard.currentRoot)
  const [selectedKeys, setSelectedKeys] = useAtom(workspace.tree.selectedKeys)
  const [expandedKeys, setExpandedKeys] = useAtom(workspace.tree.expandedKeys)
  const items = useAtomValue(unwrap(workspace.tree.items))
  const getItems = useSetAtom(workspace.tree.getItems)
  const onInsert = useSetAtom(workspace.tree.onInsert)
  const onItemDrop = useSetAtom(workspace.tree.onItemDrop)
  const onMove = useSetAtom(workspace.tree.onMove)
  const {dragAndDropHooks} = useDragAndDrop<DashboardTreeItem>({
    getItems,
    onInsert,
    onItemDrop,
    onMove
  })
  const roots = useAtomValue(workspace.roots).map(root => workspace.root(root))
  const [isTreeCollapsed, setIsTreeCollapsed] = useState(false)

  function handleRootSelect(root: DashboardRoot) {
    setIsTreeCollapsed(false)
    store.set(root.selected, true)
  }

  return (
    <>
      {currentRoot && (
        <SidebarParent
          root={currentRoot}
          roots={roots}
          isTreeCollapsed={isTreeCollapsed}
          onToggleTreeCollapsed={() =>
            setIsTreeCollapsed(isCollapsed => !isCollapsed)
          }
          onRootSelect={handleRootSelect}
        />
      )}
      <SidebarBody>
        <div className={styles.locator()}>
          <div
            className={styles.locator.rootSelector()}
            data-expanded={isTreeCollapsed || undefined}
          >
            {roots.map(root => (
              <RootButton
                key={root.key}
                root={root}
                expanded={isTreeCollapsed}
                onRootSelect={handleRootSelect}
              />
            ))}
          </div>
          {!isTreeCollapsed && (
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
          )}
        </div>
      </SidebarBody>
    </>
  )
})
