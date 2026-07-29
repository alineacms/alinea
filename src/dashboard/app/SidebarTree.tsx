import {Button, Icon, Tree, TreeItem} from '#/components.js'
import {assert} from '#/core/util/Assert.js'
import styler from '@alinea/styler'
import {atom, useAtom, useAtomValue, useSetAtom} from 'jotai'
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
import type {TreeSelection} from '../atoms/Contracts.js'
import {
  entryAtoms,
  type EntryAtoms,
  type EntryDataAtoms
} from '../atoms/EntryAtoms.js'
import type {DashboardLocaleSelection} from '../atoms/ExplorerAtoms.js'
import type {DashboardEntryTreeStatus} from '../atoms/EntrySupport.js'
import type {RootAtoms} from '../atoms/RootAtoms.js'
import {
  createTree,
  currentRootAtom,
  currentWorkspaceAtom,
  type TreeAtoms,
  type WorkspaceAtoms
} from '../atoms/WorkspaceAtoms.js'
import {routeAtom} from '../atoms/RoutingAtoms.js'
import {dispense} from '../atoms/AtomUtils.js'
import css from './SidebarTree.module.css'
import {LocaleMenu} from './LocaleMenu.js'
import {SidebarBody} from './ui/Sidebar.js'

const styles = styler(css)

function createTreeSelection(initialSelection = new Set<Key>()): TreeSelection {
  const base = atom(initialSelection)
  return atom(
    get => get(base),
    async (_get, set, next: 'all' | Set<Key>) => {
      if (next === 'all')
        throw new Error('Selecting all items is not supported')
      set(base, next)
    }
  )
}

const sidebarTreeAtoms = dispense((tree: TreeAtoms) => {
  const isExpanded = dispense((entry: EntryAtoms) => {
    return atom(get => get(tree.expandedKeys).has(entry.id))
  })
  const visibleChildren = dispense((entry: EntryAtoms) => {
    return atom(get => {
      const {data} = get(entry.data)
      if (!data || !get(data.hasChildren)) return undefined
      const children = get(unwrap(data.children))
      return children?.map(entryAtoms)
    })
  })
  const selectedAncestorStatus = dispense((entry: EntryAtoms) => {
    const status = atom(
      async (get): Promise<DashboardEntryTreeStatus | undefined> => {
        const {data} = get(entry.data)
        if (!data) return undefined
        const selectedKey = get(tree.selectedKeys).values().next().value
        if (!selectedKey) return undefined
        const selectedId = String(selectedKey)
        if (selectedId === entry.id) return undefined
        if (!get(data.parentIds).includes(selectedId)) return undefined
        const {data: selectedData} = get(entryAtoms(selectedId).data)
        return selectedData ? get(selectedData.treeStatus) : undefined
      }
    )
    return unwrap(status)
  })
  const children = dispense((entry: EntryAtoms) => {
    return atom(get => {
      if (!get(isExpanded(entry))) return undefined
      return get(visibleChildren(entry))
    })
  })
  const setExpandedKeys = atom(
    null,
    async (get, set, next: Set<Key>): Promise<void> => {
      const current = get(tree.expandedKeys)
      const opening = [...next].filter(key => !current.has(key))
      await Promise.all(
        opening.map(async key => {
          const {data} = await get(entryAtoms(String(key)).readyState)
          if (!data) return
          const childIds = await get(data.children)
          await Promise.all(childIds.map(id => get(entryAtoms(id).readyState)))
        })
      )
      set(tree.expandedKeys, next)
    }
  )
  return {children, isExpanded, selectedAncestorStatus, setExpandedKeys}
})

export interface SidebarTreeExplorerProps {
  ariaLabel?: string
  disableDragAndDrop?: boolean
  onRootPress?: () => void
  onSelectionChange?: (keys: Selection) => void
  root: RootAtoms
  rootSelected?: boolean
  selectedKeys?: Set<Key>
  selectedLocale?: DashboardLocaleSelection
  workspace: WorkspaceAtoms
}

interface SidebarItemProps {
  item: EntryAtoms
  tree: TreeAtoms
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
  return <SidebarLoadedItem item={item} data={data} tree={tree} />
})

interface SidebarLoadingItemProps {
  item: EntryAtoms
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
  item: EntryAtoms
  data: EntryDataAtoms
  tree: TreeAtoms
}

const SidebarLoadedItem = memo(function SidebarLoadedItem({
  item,
  data,
  tree
}: SidebarLoadedItemProps) {
  const treeAtoms = sidebarTreeAtoms(tree)
  const label = useAtomValue(data.label)
  const isExpanded = useAtomValue(treeAtoms.isExpanded(item))
  const status = useAtomValue(data.treeStatus)
  const selectedAncestorStatus = useAtomValue(
    treeAtoms.selectedAncestorStatus(item)
  )
  const childItems = useAtomValue(treeAtoms.children(item))
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
  root: RootAtoms
  selectedKeys?: Set<Key>
  tree: TreeAtoms
}

interface SidebarTreeContentProps extends SidebarTreeBodyProps {
  onRootPress?: () => void
  root: RootAtoms
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
  const expandedKeys = useAtomValue(tree.expandedKeys)
  const setExpandedKeys = useSetAtom(sidebarTreeAtoms(tree).setExpandedKeys)
  const rootChildren = useAtomValue(root.children)
  const items = rootChildren.map(entryAtoms)
  const dragDisabled = useAtomValue(tree.dragDisabled)
  const getItems = useSetAtom(tree.getItems)
  const getDropOperation = useSetAtom(tree.getDropOperation)
  const onInsert = useSetAtom(tree.onInsert)
  const onItemDrop = useSetAtom(tree.onItemDrop)
  const onMove = useSetAtom(tree.onMove)
  const {dragAndDropHooks} = useDragAndDrop<EntryAtoms>({
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
  root: RootAtoms
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

export const SidebarTree = memo(function SidebarTree() {
  const workspace = useAtomValue(currentWorkspaceAtom)
  assert(workspace, 'No workspace selected')
  const selectedWorkspace = workspace
  const currentRoot = useAtomValue(currentRootAtom)
  const route = useAtomValue(routeAtom)
  const setRoute = useSetAtom(routeAtom)
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
      createTree(workspace, createTreeSelection(), {
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
