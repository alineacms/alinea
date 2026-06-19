import {Button, Icon, Tree, TreeItem} from '#/components.js'
import {assert} from '#/core/util/Assert.js'
import styler from '@alinea/styler'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import {unwrap} from 'jotai/utils'
import {type ComponentType, memo, useMemo} from 'react'
import {
  Collection,
  type Key,
  ListLayout,
  type Selection,
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
  createDashboardTreeSelection,
  Dashboard,
  DashboardEntry,
  DashboardEntryData,
  type DashboardEntryTreeStatus,
  type DashboardLocaleSelection,
  DashboardRoot,
  DashboardTree,
  DashboardWorkspace
} from '../store/Dashboard.js'
import {LocaleMenu} from './LocaleMenu.js'
import css from './SidebarTree.module.css'
import {SidebarBody} from './ui/Sidebar.js'

const styles = styler(css)

interface SidebarTreeProps {
  dashboard: Dashboard
}

export interface SidebarTreeExplorerProps {
  ariaLabel?: string
  disableDragAndDrop?: boolean
  onRootPress?: () => void
  onSelectionChange?: (keys: Selection) => void
  root: DashboardRoot
  rootSelected?: boolean
  selectedKeys?: Set<Key>
  selectedLocale?: DashboardLocaleSelection
  workspace: DashboardWorkspace
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
  const childItemsAtom = useMemo(() => tree.children(item), [item, tree])
  const childItems = useAtomValue(childItemsAtom)
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
  padding: 0,
  gap: 0
}

interface SidebarTreeBodyProps {
  ariaLabel?: string
  disableDragAndDrop?: boolean
  onSelectionChange?: (keys: Selection) => void
  root: DashboardRoot
  selectedKeys?: Set<Key>
  tree: DashboardTree
}

interface SidebarTreeContentProps extends SidebarTreeBodyProps {
  onRootPress?: () => void
  root: DashboardRoot
  rootSelected?: boolean
  selectedLocale?: DashboardLocaleSelection
}

const SidebarTreeBody = memo(function SidebarTreeBody({
  ariaLabel = 'Content tree',
  disableDragAndDrop = false,
  onSelectionChange,
  root,
  selectedKeys,
  tree
}: SidebarTreeBodyProps) {
  const [treeSelectedKeys, setTreeSelectedKeys] = useAtom(tree.selectedKeys)
  const [expandedKeys, setExpandedKeys] = useAtom(tree.expandedKeys)
  const rootChildren = useAtomValue(root.children)
  const items = rootChildren.map(id => tree.entryItems(id))
  const dragDisabled = useAtomValue(tree.dragDisabled)
  const getItems = useSetAtom(tree.getItems)
  const getDropOperation = useSetAtom(tree.getDropOperation)
  const onInsert = useSetAtom(tree.onInsert)
  const onItemDrop = useSetAtom(tree.onItemDrop)
  const onMove = useSetAtom(tree.onMove)
  const {dragAndDropHooks} = useDragAndDrop<DashboardEntry>({
    acceptedDragTypes: tree.acceptedDragTypes,
    getItems,
    isDisabled: disableDragAndDrop || dragDisabled,
    getDropOperation,
    onInsert,
    onItemDrop,
    onMove
  })
  const controlledSelection =
    selectedKeys !== undefined && onSelectionChange !== undefined
  return (
    <div className={styles.SidebarTree.tree.viewport()}>
      <Virtualizer layout={ListLayout} layoutOptions={treeLayoutOptions}>
        <Tree
          aria-label={ariaLabel}
          items={items}
          dragAndDropHooks={dragAndDropHooks}
          selectionMode="single"
          selectionBehavior="replace"
          disallowEmptySelection={!controlledSelection}
          expandedKeys={expandedKeys}
          onExpandedChange={setExpandedKeys}
          selectedKeys={controlledSelection ? selectedKeys : treeSelectedKeys}
          onSelectionChange={
            controlledSelection ? onSelectionChange : setTreeSelectedKeys
          }
        >
          {item => <SidebarItem item={item} tree={tree} />}
        </Tree>
      </Virtualizer>
    </div>
  )
})

function SidebarTreeRootButton({
  onPress,
  root,
  selected,
  selectedLocale
}: {
  onPress?: () => void
  root: DashboardRoot
  selected: boolean
  selectedLocale?: DashboardLocaleSelection
}) {
  const label = useAtomValue(root.label)
  const icon = useAtomValue(root.icon)
  const i18n = useAtomValue(root.i18n)
  return (
    <div className={styles.SidebarTree.rootButton({selected})}>
      <Button
        appearance="plain"
        className={styles.SidebarTree.rootButton.action()}
        icon={icon}
        onPress={onPress}
      >
        <span className={styles.SidebarTree.rootButton.label()}>{label}</span>
      </Button>
      {i18n && i18n.locales.length > 0 && (
        <span className={styles.SidebarTree.rootButton.locale()}>
          <LocaleMenu root={root} selectedLocale={selectedLocale} />
        </span>
      )}
    </div>
  )
}

function SidebarTreeContent({
  onRootPress,
  root,
  rootSelected = false,
  selectedLocale,
  ...bodyProps
}: SidebarTreeContentProps) {
  return (
    <SidebarBody>
      <div className={styles.SidebarTree.tree()}>
        <div className={styles.SidebarTree.root()}>
          <SidebarTreeRootButton
            root={root}
            selected={rootSelected}
            selectedLocale={selectedLocale}
            onPress={onRootPress}
          />
        </div>
        <SidebarTreeBody root={root} {...bodyProps} />
      </div>
    </SidebarBody>
  )
}

export const SidebarTree = memo(function SidebarTree({
  dashboard
}: SidebarTreeProps) {
  const workspace = useAtomValue(dashboard.currentWorkspace)
  assert(workspace, 'No workspace selected')
  const selectedWorkspace = workspace
  const currentRoot = useAtomValue(dashboard.currentRoot)
  const route = useAtomValue(dashboard.route)
  const setRoute = useSetAtom(dashboard.route)
  function onRootPress() {
    if (!currentRoot) return
    setRoute({
      workspace: selectedWorkspace.key,
      root: currentRoot.key,
      locale: route.locale
    })
  }
  return (
    <>
      {currentRoot && (
        <SidebarTreeContent
          root={currentRoot}
          rootSelected={!route.entry}
          tree={selectedWorkspace.tree}
          onRootPress={onRootPress}
        />
      )}
    </>
  )
})

export const SidebarTreeExplorer = memo(function SidebarTreeExplorer({
  ariaLabel = 'Explorer folders',
  disableDragAndDrop = true,
  onRootPress,
  onSelectionChange,
  root,
  rootSelected = false,
  selectedKeys,
  selectedLocale,
  workspace
}: SidebarTreeExplorerProps) {
  const tree = useMemo(
    () =>
      new DashboardTree(workspace, createDashboardTreeSelection(), {
        syncRouteExpansion: false
      }),
    [workspace]
  )
  return (
    <SidebarTreeContent
      ariaLabel={ariaLabel}
      disableDragAndDrop={disableDragAndDrop}
      onRootPress={onRootPress}
      onSelectionChange={onSelectionChange}
      root={root}
      rootSelected={rootSelected}
      selectedKeys={selectedKeys}
      selectedLocale={selectedLocale}
      tree={tree}
    />
  )
})
