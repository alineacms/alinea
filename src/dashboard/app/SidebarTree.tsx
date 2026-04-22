import {
  Button,
  Icon,
  ProgressCircle,
  Tooltip,
  Tree,
  TreeItem
} from '#/components.js'
import {assert} from '#/core/util/Assert.js'
import styler from '@alinea/styler'
import {atom, useAtom, useAtomValue, useSetAtom} from 'jotai'
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
  DashboardTreeItem,
  DashboardWorkspace
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
  isTreeCollapsed: boolean
  onToggleTreeCollapsed: () => void
}

const SidebarParent = memo(function SidebarParent({
  root,
  isTreeCollapsed,
  onToggleTreeCollapsed
}: SidebarParentProps) {
  const label = useAtomValue(root.label)
  const selectRoot = useSetAtom(root.selected)
  return (
    <SidebarHeader>
      <div className={styles.SidebarParent.label()}>
        <Button
          size="icon"
          appearance="outline"
          icon={IcRoundKeyboardTab}
          style={isTreeCollapsed ? undefined : {transform: 'rotate(180deg)'}}
          aria-label={isTreeCollapsed ? 'Expand tree' : 'Collapse tree'}
          onPress={onToggleTreeCollapsed}
        />
        <Button
          appearance="plain"
          intent="secondary"
          className={styles.SidebarTree.rootsTrigger()}
          onPress={() => selectRoot(true)}
        >
          {label}
        </Button>
        <LocaleMenu root={root} />
        <DialogTrigger>
          <Button size="icon" icon={IcRoundAdd} />
          <Sheet>
            <CreateEntry />
          </Sheet>
        </DialogTrigger>
      </div>
    </SidebarHeader>
  )
})

interface SidebarItemProps {
  item: DashboardTreeItem
}

const SidebarItem = memo(function SidebarItem({item}: SidebarItemProps) {
  const label = useAtomValue(item.label)
  const isExpanded = useAtomValue(item.isExpanded)
  const childItems = useAtomValue(
    useMemo(() => {
      if (!item.hasChildren)
        return atom<Array<DashboardTreeItem> | undefined>(undefined)
      return unwrap(
        atom(async get => {
          if (!get(item.isExpanded)) return undefined
          return get(item.items)
        })
      )
    }, [item])
  )
  let icon = useAtomValue(item.icon)
  if (!icon) icon = item.hasChildren ? IcTwotoneFolder : IcTwotoneDescription
  const isLoadingChildren =
    item.hasChildren && isExpanded && childItems === undefined

  return (
    <TreeItem
      id={item.id}
      textValue={label}
      title={label}
      hasChildItems={item.hasChildren}
      icon={icon}
      suffix={
        isLoadingChildren ? (
          <span
            className={styles.SidebarTree.itemLoading()}
            aria-hidden="true"
          />
        ) : undefined
      }
    >
      {isExpanded && childItems && (
        <Collection items={childItems}>{renderItem}</Collection>
      )}
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

interface SidebarTreeBodyProps {
  workspace: DashboardWorkspace
}

const SidebarTreeBody = memo(function SidebarTreeBody({
  workspace
}: SidebarTreeBodyProps) {
  const [selectedKeys, setSelectedKeys] = useAtom(workspace.tree.selectedKeys)
  const [expandedKeys, setExpandedKeys] = useAtom(workspace.tree.expandedKeys)
  const items = useAtomValue(workspace.tree.items)
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
  return (
    <div className={styles.SidebarTree.tree.viewport()}>
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
  )
})

interface SidebarTreeRootsProps {
  roots: Array<DashboardRoot>
  isTreeCollapsed: boolean
}

const SidebarTreeRoots = memo(function SidebarTreeRoots({
  roots,
  isTreeCollapsed
}: SidebarTreeRootsProps) {
  return (
    <div
      className={styles.SidebarTree.locator.rootSelector()}
      data-expanded={isTreeCollapsed || undefined}
    >
      {roots.map(root => (
        <RootButton key={root.key} root={root} expanded={isTreeCollapsed} />
      ))}
    </div>
  )
})

const SidebarTreeBodyFallback = memo(function SidebarTreeBodyFallback() {
  return (
    <div className={styles.SidebarTree.loading()}>
      <ProgressCircle isIndeterminate aria-label="Loading content tree" />
    </div>
  )
})

interface RootButtonProps {
  root: DashboardRoot
  expanded?: boolean
}

function RootButton({root, expanded = false}: RootButtonProps) {
  const icon = useAtomValue(root.icon)
  const label = useAtomValue(root.label)
  const [selected, setSelected] = useAtom(root.selected)
  const button = (
    <Button
      size="square-petite"
      appearance={selected ? 'active' : 'plain'}
      className={styles.SidebarTree.rootButton()}
      data-expanded={expanded || undefined}
      aria-label={label}
      onPress={() => setSelected(true)}
    >
      {icon && <Icon icon={icon} data-slot="icon" />}
      {expanded && (
        <span className={styles.SidebarTree.rootButton.label()}>{label}</span>
      )}
    </Button>
  )
  if (expanded) return button
  return (
    <Tooltip placement="right" delay={100} tooltip={label}>
      {button}
    </Tooltip>
  )
}

export const SidebarTree = memo(function SidebarTree({
  dashboard
}: SidebarTreeProps) {
  const workspace = useAtomValue(dashboard.currentWorkspace)
  assert(workspace, 'No workspace selected')
  const currentRoot = useAtomValue(dashboard.currentRoot)
  const roots = useAtomValue(workspace.roots).map(root => workspace.root(root))
  const [isTreeCollapsed, setIsTreeCollapsed] = useState(false)
  return (
    <>
      {currentRoot && (
        <SidebarParent
          root={currentRoot}
          isTreeCollapsed={isTreeCollapsed}
          onToggleTreeCollapsed={() =>
            setIsTreeCollapsed(isCollapsed => !isCollapsed)
          }
        />
      )}
      <SidebarBody>
        <div className={styles.SidebarTree.locator()}>
          <SidebarTreeRoots roots={roots} isTreeCollapsed={isTreeCollapsed} />
          <div
            className={styles.SidebarTree.tree({collapsed: isTreeCollapsed})}
          >
            <Suspense fallback={<SidebarTreeBodyFallback />}>
              <SidebarTreeBody workspace={workspace} />
            </Suspense>
          </div>
        </div>
      </SidebarBody>
    </>
  )
})
