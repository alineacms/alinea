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
import {type ComponentType, memo, Suspense, useMemo, useState} from 'react'
import {
  Collection,
  DialogTrigger,
  ListLayout,
  useDragAndDrop,
  Virtualizer
} from 'react-aria-components'
import {
  IcOutlineArchive,
  IcRoundAdd,
  IcRoundEdit,
  IcRoundKeyboardTab,
  IcRoundTranslate,
  IcTwotoneDescription,
  IcTwotoneFolder,
  RiFlashlightFill
} from '../icons.js'
import {
  Dashboard,
  type DashboardEntryTreeStatus,
  DashboardRoot,
  DashboardTreeItem,
  DashboardWorkspace
} from '../store/Dashboard.js'
import {LocaleMenu} from './LocaleMenu.js'
import {CreateEntry} from './modals/CreateEntry.js'
import css from './SidebarTree.module.css'
import {DashboardModal} from './ui/DashboardModal.js'
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
  const policy = useAtomValue(root.workspace.dashboard.policy)
  const canCreate = policy.canCreate({
    workspace: root.workspace.key,
    root: root.key
  })
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
          className={styles.SidebarTree.rootsTrigger()}
          onPress={() => selectRoot(true)}
        >
          {label}
        </Button>
        <LocaleMenu root={root} />
        {canCreate && (
          <DialogTrigger>
            <Button size="icon" icon={IcRoundAdd} intent="primary" />
            <DashboardModal>
              <CreateEntry />
            </DashboardModal>
          </DialogTrigger>
        )}
      </div>
    </SidebarHeader>
  )
})

interface SidebarItemProps {
  item: DashboardTreeItem
}

interface SidebarStatusDisplay {
  icon: ComponentType
  label: string
  status: 'draft' | 'unpublished' | 'archived' | 'untranslated'
}

function sidebarStatus(
  treeStatus: DashboardEntryTreeStatus
): SidebarStatusDisplay | undefined {
  if (treeStatus.status === 'untranslated') {
    return {
      icon: IcRoundTranslate,
      label: 'Untranslated',
      status: 'untranslated'
    }
  }
  if (treeStatus.status === 'archived') {
    return {
      icon: IcOutlineArchive,
      label: 'Archived',
      status: 'archived'
    }
  }
  if (treeStatus.status === 'unpublished') {
    return {
      icon: RiFlashlightFill,
      label: 'Unpublished',
      status: 'unpublished'
    }
  }
  if (treeStatus.status === 'draft') {
    return {
      icon: IcRoundEdit,
      label: 'Draft',
      status: 'draft'
    }
  }
  return undefined
}

function affectedStatus(
  ownStatus: DashboardEntryTreeStatus,
  ancestorStatus: DashboardEntryTreeStatus | undefined
) {
  if (ancestorStatus?.status === 'archived') return ancestorStatus
  if (ancestorStatus?.status === 'unpublished') return ancestorStatus
  return ownStatus
}

const SidebarItem = memo(function SidebarItem({item}: SidebarItemProps) {
  const label = useAtomValue(item.label)
  const isExpanded = useAtomValue(item.isExpanded)
  const status = useAtomValue(item.status)
  const selectedAncestorStatus = useAtomValue(
    useMemo(() => unwrap(item.selectedAncestorStatus), [item])
  )
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
  const displayStatus = sidebarStatus(status)
  const rowStatus = affectedStatus(status, selectedAncestorStatus)
  const isArchived = rowStatus.status === 'archived'
  const isUnpublished = rowStatus.status === 'unpublished'

  return (
    <TreeItem
      id={item.id}
      textValue={label}
      title={label}
      hasChildItems={item.hasChildren}
      icon={icon}
      className={styles.SidebarTree.item({
        archived: isArchived,
        unpublished: isUnpublished,
        untranslated: status.status === 'untranslated',
        parentSelected: selectedAncestorStatus !== undefined
      })}
      suffix={
        isLoadingChildren ? (
          <span
            className={styles.SidebarTree.itemLoading()}
            aria-hidden="true"
          />
        ) : displayStatus ? (
          <span
            className={styles.SidebarTree.status({
              [displayStatus.status]: true
            })}
            aria-label={displayStatus.label}
            role="img"
            title={displayStatus.label}
          >
            <Icon icon={displayStatus.icon} />
          </span>
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
  padding: 6,
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
  const policy = useAtomValue(workspace.dashboard.policy)
  const currentRoot = useAtomValue(workspace.dashboard.currentRoot)
  const currentRootResource = currentRoot
    ? {workspace: workspace.key, root: currentRoot.key}
    : undefined
  const canDrop = Boolean(
    currentRootResource &&
      (policy.canMove(currentRootResource) ||
        policy.canReorder(currentRootResource))
  )
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
          items={items}
          dragAndDropHooks={canDrop ? dragAndDropHooks : undefined}
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
  const policy = useAtomValue(dashboard.policy)
  const currentRoot = useAtomValue(dashboard.currentRoot)
  const roots = useAtomValue(workspace.roots)
    .filter(root => policy.canRead({workspace: workspace.key, root}))
    .map(root => workspace.root(root))
  const activeRoot =
    currentRoot &&
    policy.canRead({workspace: workspace.key, root: currentRoot.key})
      ? currentRoot
      : roots[0]
  const [isTreeCollapsed, setIsTreeCollapsed] = useState(false)
  return (
    <>
      {activeRoot && (
        <SidebarParent
          root={activeRoot}
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
            {activeRoot && currentRoot === activeRoot && (
              <Suspense fallback={<SidebarTreeBodyFallback />}>
                <SidebarTreeBody workspace={workspace} />
              </Suspense>
            )}
          </div>
        </div>
      </SidebarBody>
    </>
  )
})
