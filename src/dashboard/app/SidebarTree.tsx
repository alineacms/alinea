import {
  Button,
  Icon,
  ProgressCircle,
  ToggleButton,
  Tooltip,
  Tree,
  TreeItem
} from '#/components.js'
import {assert} from '#/core/util/Assert.js'
import styler from '@alinea/styler'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
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
  IcRoundTranslate,
  IcTwotoneDescription,
  IcTwotoneFolder,
  MaterialSymbolsLeftPanelOpenOutlineRounded,
  RiFlashlightFill
} from '../icons.js'
import {
  Dashboard,
  DashboardEntry,
  type DashboardEntryTreeStatus,
  DashboardRoot,
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
}

const SidebarParent = memo(function SidebarParent({root}: SidebarParentProps) {
  const label = useAtomValue(root.label)
  const selectRoot = useSetAtom(root.selected)
  const canCreate = useAtomValue(root.canCreate)
  return (
    <SidebarHeader>
      <div className={styles.SidebarParent.label()}>
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
  item: DashboardEntry
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
  const status = useAtomValue(item.treeStatus)
  const selectedAncestorStatus = useAtomValue(
    useMemo(() => unwrap(item.selectedAncestorStatus), [item])
  )
  const childItems = useAtomValue(item.treeChildren)
  const hasChildren = useAtomValue(item.hasChildren)
  let icon = useAtomValue(item.icon)
  if (!icon) icon = hasChildren ? IcTwotoneFolder : IcTwotoneDescription
  const isLoadingChildren =
    hasChildren && isExpanded && childItems === undefined
  const displayStatus = sidebarStatus(status)
  const rowStatus = affectedStatus(status, selectedAncestorStatus)
  const isArchived = rowStatus.status === 'archived'
  const isUnpublished = rowStatus.status === 'unpublished'

  return (
    <TreeItem
      id={item.id}
      textValue={label}
      title={label}
      hasChildItems={hasChildren}
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

function renderItem(item: DashboardEntry) {
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
  const dragDisabled = useAtomValue(workspace.tree.dragDisabled)
  const getItems = useSetAtom(workspace.tree.getItems)
  const getDropOperation = useSetAtom(workspace.tree.getDropOperation)
  const onInsert = useSetAtom(workspace.tree.onInsert)
  const onItemDrop = useSetAtom(workspace.tree.onItemDrop)
  const onMove = useSetAtom(workspace.tree.onMove)
  const {dragAndDropHooks} = useDragAndDrop<DashboardEntry>({
    acceptedDragTypes: workspace.tree.acceptedDragTypes,
    getItems,
    isDisabled: dragDisabled,
    getDropOperation,
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
  isTreeOpen: boolean
  onTreeOpenChange: (isTreeOpen: boolean) => void
}

const SidebarTreeRoots = memo(function SidebarTreeRoots({
  roots,
  isTreeOpen,
  onTreeOpenChange
}: SidebarTreeRootsProps) {
  return (
    <div
      className={styles.SidebarTree.locator.rootSelector()}
      data-expanded={!isTreeOpen || undefined}
    >
      {roots.map(root => (
        <RootButton key={root.key} root={root} expanded={!isTreeOpen} />
      ))}
      <ToggleButton
        isSelected={!isTreeOpen}
        className={styles.SidebarTree.locator.expandButton()}
        aria-label={isTreeOpen ? 'Hide file tree' : 'Show file tree'}
        onChange={value => onTreeOpenChange(!value)}
      >
        <MaterialSymbolsLeftPanelOpenOutlineRounded data-slot="icon" />
      </ToggleButton>
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
      size="icon-nav"
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
  const [isTreeOpen, setIsTreeOpen] = useState(true)
  return (
    <>
      {currentRoot && <SidebarParent root={currentRoot} />}
      <SidebarBody>
        <div className={styles.SidebarTree.locator()}>
          <SidebarTreeRoots
            roots={roots}
            isTreeOpen={isTreeOpen}
            onTreeOpenChange={setIsTreeOpen}
          />
          <div className={styles.SidebarTree.tree({collapsed: !isTreeOpen})}>
            <Suspense fallback={<SidebarTreeBodyFallback />}>
              <SidebarTreeBody workspace={workspace} />
            </Suspense>
          </div>
        </div>
      </SidebarBody>
    </>
  )
})
