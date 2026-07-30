import {Button, Icon, Tree, TreeItem} from '#/components.js'
import {assert} from '#/core/util/Assert.js'
import styler from '@alinea/styler'
import {atom, useAtomValue, useSetAtom} from 'jotai'
import {type ComponentType, memo, useMemo, useState} from 'react'
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
  entryAtoms,
  type EntryAtoms,
  type EntryDataAtoms
} from '../atoms/entry.js'
import type {DashboardEntryTreeStatus} from '../atoms/entry/load.js'
import {type DashboardLocaleSelection} from '../atoms/explorer.js'
import {
  currentRootAtom,
  currentWorkspaceAtom,
  TreeAtoms,
  type RootAtoms,
  type TreeSnapshot,
  type WorkspaceAtoms
} from '../atoms/config.js'
import {navigationAtoms, routeAtom} from '../atoms/routing.js'
import css from './SidebarTree.module.css'
import {LocaleMenu} from './LocaleMenu.js'
import {SidebarBody} from './ui/Sidebar.js'

const styles = styler(css)

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
  root: RootAtoms
  selectedKey: Key | undefined
  snapshot: TreeSnapshot
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

const SidebarItem = memo(function SidebarItem({
  item,
  root,
  selectedKey,
  snapshot,
  tree
}: SidebarItemProps) {
  const {data, pending} = useAtomValue(item.data)
  if (pending || !data) return null
  return (
    <SidebarLoadedItem
      item={item}
      data={data}
      root={root}
      selectedKey={selectedKey}
      snapshot={snapshot}
      tree={tree}
    />
  )
})

interface SidebarLoadedItemProps extends SidebarItemProps {
  data: EntryDataAtoms
}

const SidebarLoadedItem = memo(function SidebarLoadedItem({
  item,
  data,
  root,
  selectedKey,
  snapshot,
  tree
}: SidebarLoadedItemProps) {
  const label = useAtomValue(data.label)
  const status = useAtomValue(data.treeStatus)
  const expand = useSetAtom(tree.expand(root))
  const selectedAncestorStatusAtom = useMemo(
    () =>
      atom((get): DashboardEntryTreeStatus | undefined => {
        if (!selectedKey) return undefined
        const selectedId = String(selectedKey)
        if (selectedId === item.id) return undefined
        if (
          !get(data.entryData).parents.some(parent => parent.id === selectedId)
        )
          return undefined
        const {data: selectedData} = get(entryAtoms(selectedId).data)
        return selectedData ? get(selectedData.treeStatus) : undefined
      }),
    [data, item.id, selectedKey]
  )
  const selectedAncestorStatus = useAtomValue(selectedAncestorStatusAtom)
  const childItems = snapshot.children.get(item.id)
  let icon = useAtomValue(data.icon)
  const hasChildren = useAtomValue(data.entryData).hasChildren
  if (!icon) icon = hasChildren ? LucideFolder : LucideFile
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
      onPress={hasChildren ? () => void expand(item.id) : undefined}
      icon={icon}
      className={styles.SidebarTree.item({
        archived: isArchived,
        unpublished: isUnpublished,
        untranslated: status.status === 'untranslated',
        parentSelected: selectedAncestorStatus !== undefined
      })}
      suffix={
        displayStatus ? (
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
      {childItems && (
        <Collection items={childItems}>
          {child => (
            <SidebarItem
              item={child}
              root={root}
              selectedKey={selectedKey}
              snapshot={snapshot}
              tree={tree}
            />
          )}
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
  const [localSelectedKeys, setLocalSelectedKeys] = useState<Selection>(
    new Set()
  )
  const expandedKeys = useAtomValue(tree.expandedKeys)
  const setExpandedKeys = useSetAtom(tree.setExpandedKeys(root))
  const snapshot = useAtomValue(tree.snapshot(root))
  const dragDisabled = useAtomValue(tree.dragDisabled)
  const onInsert = useSetAtom(tree.onInsert)
  const onItemDrop = useSetAtom(tree.onItemDrop)
  const onMove = useSetAtom(tree.onMove)
  const {dragAndDropHooks} = useDragAndDrop<EntryAtoms>({
    acceptedDragTypes: tree.acceptedDragTypes,
    getItems: tree.getItems,
    isDisabled: disableDragAndDrop || dragDisabled,
    getDropOperation: tree.getDropOperation,
    onInsert,
    onItemDrop,
    onMove
  })
  const controlledSelection =
    selectedKeys !== undefined && onSelectionChange !== undefined
  const currentSelectedKeys = controlledSelection
    ? selectedKeys
    : localSelectedKeys
  const selectedKey =
    currentSelectedKeys === 'all'
      ? undefined
      : currentSelectedKeys.values().next().value
  return (
    <div className={styles.SidebarTree.tree.viewport()}>
      <Virtualizer layout={ListLayout} layoutOptions={treeLayoutOptions}>
        <Tree
          aria-label={ariaLabel}
          items={snapshot.items}
          dependencies={[snapshot, selectedKey]}
          dragAndDropHooks={dragAndDropHooks}
          selectionMode="single"
          selectionBehavior="replace"
          disallowEmptySelection={!controlledSelection}
          expandedKeys={expandedKeys}
          onExpandedChange={setExpandedKeys}
          selectedKeys={currentSelectedKeys}
          onSelectionChange={
            controlledSelection ? onSelectionChange : setLocalSelectedKeys
          }
        >
          {item => (
            <SidebarItem
              item={item}
              root={root}
              selectedKey={selectedKey}
              snapshot={snapshot}
              tree={tree}
            />
          )}
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
  const settings = useAtomValue(root.settings)
  const label = settings.label
  const icon = useAtomValue(root.icon)
  const i18n = settings.i18n
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
  const requestedRoute = useAtomValue(navigationAtoms.requestedRoute)
  const setRoute = useSetAtom(routeAtom)
  function onRootPress() {
    if (!currentRoot) return
    setRoute({
      workspace: selectedWorkspace.key,
      root: currentRoot.key,
      locale: route.locale
    })
  }
  function onSelectionChange(keys: Selection) {
    if (keys === 'all') return
    const [entry] = keys
    if (!entry || !currentRoot) return
    void setRoute({
      workspace: selectedWorkspace.key,
      root: currentRoot.key,
      entry: String(entry),
      locale: route.locale
    })
  }
  const selectedKeys =
    requestedRoute.entry &&
    (!requestedRoute.workspace ||
      requestedRoute.workspace === selectedWorkspace.key)
      ? new Set<Key>([requestedRoute.entry])
      : new Set<Key>()
  return (
    <>
      {currentRoot && (
        <SidebarTreeContent
          root={currentRoot}
          rootSelected={!requestedRoute.entry}
          selectedKeys={selectedKeys}
          tree={selectedWorkspace.tree}
          onRootPress={onRootPress}
          onSelectionChange={onSelectionChange}
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
  const tree = useMemo(() => new TreeAtoms(workspace), [workspace])
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
