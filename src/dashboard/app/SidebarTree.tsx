import {Icon, Tree, TreeItem} from '#/components.js'
import {assert} from '#/core/util/Assert.js'
import styler from '@alinea/styler'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import {unwrap} from 'jotai/utils'
import {type ComponentType, memo, useMemo} from 'react'
import {
  Collection,
  ListLayout,
  useDragAndDrop,
  Virtualizer
} from 'react-aria-components'
import {
  IcOutlineArchive,
  IcRoundEdit,
  IcRoundTranslate,
  LucideFile,
  LucideFolder,
  RiFlashlightFill
} from '../icons.js'
import {
  Dashboard,
  DashboardEntry,
  DashboardEntryData,
  type DashboardEntryTreeStatus,
  DashboardRoot,
  DashboardTree,
  DashboardWorkspace
} from '../store/Dashboard.js'
import css from './SidebarTree.module.css'
import {LocaleMenu} from './LocaleMenu.js'
import {RailHeader} from './ui/Rail.js'
import {SidebarBody} from './ui/Sidebar.js'

const styles = styler(css)

interface SidebarTreeProps {
  dashboard: Dashboard
}

interface SidebarItemProps {
  item: DashboardEntry
  tree: DashboardTree
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

const SidebarItem = memo(function SidebarItem({item, tree}: SidebarItemProps) {
  const {pending, data} = useAtomValue(item.data)
  if (!data) return <SidebarLoadingItem item={item} pending={pending} />
  return (
    <SidebarLoadedItem item={item} data={data} tree={tree} pending={pending} />
  )
})

interface SidebarLoadingItemProps {
  item: DashboardEntry
  pending: boolean
}

function SidebarLoadingItem({item, pending}: SidebarLoadingItemProps) {
  return (
    <TreeItem
      id={item.id}
      textValue="Loading entry"
      title="Loading entry"
      icon={LucideFile}
      label={
        <span
          className={styles.SidebarTree.itemSkeleton.label()}
          aria-hidden="true"
        />
      }
      className={styles.SidebarTree.item({loading: true})}
      suffix={
        pending ? (
          <span
            className={styles.SidebarTree.itemLoading()}
            aria-hidden="true"
          />
        ) : undefined
      }
    />
  )
}

interface SidebarLoadedItemProps {
  item: DashboardEntry
  data: DashboardEntryData
  tree: DashboardTree
  pending: boolean
}

const SidebarLoadedItem = memo(function SidebarLoadedItem({
  item,
  data,
  tree,
  pending
}: SidebarLoadedItemProps) {
  const label = useAtomValue(data.label)
  const isExpanded = useAtomValue(tree.isExpanded(item))
  const status = useAtomValue(data.treeStatus)
  const selectedAncestorStatus = useAtomValue(
    useMemo(() => unwrap(tree.selectedAncestorStatus(item)), [item, tree])
  )
  const childItems = useAtomValue(tree.children(item))
  let icon = useAtomValue(data.icon)
  const hasChildren = useAtomValue(data.hasChildren)
  if (!icon) icon = hasChildren ? LucideFolder : LucideFile
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
        isLoadingChildren || pending ? (
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
        <Collection items={childItems}>
          {child => <SidebarItem item={child} tree={tree} />}
        </Collection>
      )}
    </TreeItem>
  )
})

const treeLayoutOptions = {
  rowHeight: 32,
  padding: 8,
  gap: 0
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
          {item => <SidebarItem item={item} tree={workspace.tree} />}
        </Tree>
      </Virtualizer>
    </div>
  )
})

interface SidebarLocaleMenuProps {
  root: DashboardRoot
}

function SidebarLocaleMenu({root}: SidebarLocaleMenuProps) {
  const i18n = useAtomValue(root.i18n)
  if (!i18n || i18n.locales.length === 0) return null
  return (
    <RailHeader>
      <LocaleMenu root={root} />
    </RailHeader>
  )
}

export const SidebarTree = memo(function SidebarTree({
  dashboard
}: SidebarTreeProps) {
  const workspace = useAtomValue(dashboard.currentWorkspace)
  assert(workspace, 'No workspace selected')
  const currentRoot = useAtomValue(dashboard.currentRoot)
  return (
    <>
      {currentRoot && <SidebarLocaleMenu root={currentRoot} />}
      <SidebarBody>
        <div className={styles.SidebarTree.tree()}>
          <SidebarTreeBody workspace={workspace} />
        </div>
      </SidebarBody>
    </>
  )
})
