import {Button, Menu, MenuItem, Tree, TreeItem} from '@alinea/components'
import styler from '@alinea/styler'
import {assert} from 'alinea/core/util/Assert'
import {IcRoundUnfoldMore} from 'alinea/ui/icons/IcRoundUnfoldMore.js'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import {unwrap} from 'jotai/utils'
import {memo, Suspense, useMemo} from 'react'
import {
  Collection,
  DialogTrigger,
  ListLayout,
  useDragAndDrop,
  Virtualizer
} from 'react-aria-components'
import {
  IcRoundAdd,
  IcRoundArrowBack,
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
  dashboard: Dashboard
  root: DashboardRoot
}

const SidebarParent = memo(function SidebarParent({
  root,
  dashboard
}: SidebarParentProps) {
  const workspace = useAtomValue(dashboard.currentWorkspace)
  assert(workspace, 'No workspace selected')
  const roots = useAtomValue(workspace.roots)

  const label = useAtomValue(root.label)
  return (
    <SidebarHeader>
      <div className={styles.focusLabel()}>
        <Button size="icon" appearance="outline" icon={IcRoundArrowBack} />
        <Menu
          label={
            <Button
              appearance="outline"
              intent="secondary"
              className={styles.rootsTrigger()}
            >
              {label} <IcRoundUnfoldMore />
            </Button>
          }
          aria-label={label}
          selectionMode="single"
          selectedKeys={new Set([root.key])}
        >
          {roots.map(root => (
            <RootMenuItem key={root} root={workspace.root(root)} />
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

interface RootButton {
  root: DashboardRoot
}

function RootButton({root}: RootButton) {
  const icon = useAtomValue(root.icon)
  const [selected, setSelected] = useAtom(root.selected)
  return (
    <Button
      size="square-petite"
      appearance={selected ? 'active' : 'plain'}
      onPress={() => setSelected(true)}
      icon={icon}
    />
  )
}

interface RootMenuItemProps {
  root: DashboardRoot
}

function RootMenuItem({root}: RootMenuItemProps) {
  const label = useAtomValue(root.label)
  const setSelected = useSetAtom(root.selected)
  return (
    <MenuItem key={root.key} id={root.key} onAction={() => setSelected(true)}>
      {label}
    </MenuItem>
  )
}

export const SidebarTree = memo(function SidebarTree({
  dashboard
}: SidebarTreeProps) {
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
  const roots = useAtomValue(workspace.roots)

  return (
    <>
      {currentRoot && (
        <SidebarParent root={currentRoot} dashboard={dashboard} />
      )}
      <SidebarBody>
        <div className={styles.locator()}>
          <div className={styles.locator.rootSelector()}>
            {roots.map(root => (
              <RootButton key={root} root={workspace.root(root)} />
            ))}
          </div>
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
      </SidebarBody>
    </>
  )
})
