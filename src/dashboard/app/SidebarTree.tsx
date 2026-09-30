import {
  Button,
  Icon,
  SidebarContent,
  Tree,
  TreeItem,
  type DragDropProps,
  type DragMoveEvent,
  type Key,
  type Selection
} from '#/components.js'
import {typeAtoms} from '../atoms/config.js'
import {nav, routeAtom, type Page} from '../atoms/nav.js'
import {configAtom} from '../atoms/core.js'
import {
  type RootAtoms,
  type RootTreeItem,
  type RootTreeNode,
  type TreeAtoms,
  type TreeSnapshot,
  treeAcceptsDrop
} from '../atoms/root.js'
import styler from '@alinea/styler'
import {
  useAtom,
  useAtomValueRaw,
  useSetAtom,
  useStore,
  type WritableAtom
} from 'jotai'
import {
  memo,
  type ComponentType,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef
} from 'react'
import {
  IcOutlineArchive,
  IcRoundEdit,
  IcRoundTranslate,
  LucideFile,
  LucideFolder,
  RiFlashlightFill
} from '../icons.js'
import {LocaleMenu} from './LocaleMenu.js'
import css from './SidebarTree.module.css'

const styles = styler(css)

export interface SidebarTreeProps {
  page: Page
  root: RootAtoms
}

export interface SidebarTreeExplorerProps {
  ariaLabel?: string
  disableDragAndDrop?: boolean
  onRootPress?: () => void
  onSelectionChange?: (keys: Selection) => void
  root: RootAtoms
  rootSelected?: boolean
  selectedLocale: WritableAtom<string | null, [string], unknown>
  tree: TreeAtoms
}

interface SidebarStatusDisplay {
  icon: ComponentType
  label: string
  status: 'draft' | 'unpublished' | 'archived' | 'untranslated'
}

function sidebarStatus(
  item: RootTreeItem,
  locale: string | null
): SidebarStatusDisplay | undefined {
  if (locale && item.locale !== locale)
    return {
      icon: IcRoundTranslate,
      label: 'Untranslated',
      status: 'untranslated'
    }
  if (item.status === 'archived')
    return {icon: IcOutlineArchive, label: 'Archived', status: 'archived'}
  if (item.status === 'draft' && item.main)
    return {icon: RiFlashlightFill, label: 'Unpublished', status: 'unpublished'}
  if (item.status === 'draft')
    return {icon: IcRoundEdit, label: 'Draft', status: 'draft'}
}

interface SidebarTreeItemProps {
  children?: (item: RootTreeNode) => ReactNode
  data: RootTreeItem
  entryLink?: (entry: RootTreeItem) => SidebarTreeLink
  /** The last visible row within the selected entry */
  groupEnd?: boolean
  item: RootTreeNode
  locale: string | null
  selectedItem?: RootTreeItem
}

export const SidebarTreeItem = memo(function SidebarTreeItem({
  children,
  data,
  entryLink,
  groupEnd,
  item,
  locale,
  selectedItem
}: SidebarTreeItemProps) {
  const configuredIcon = useAtomValueRaw(typeAtoms(data.type)).icon
  const displayStatus = sidebarStatus(data, locale)
  const selectedAncestor =
    selectedItem && data.parents.includes(selectedItem.id)
      ? selectedItem
      : undefined
  const selectedStatus = selectedAncestor
    ? sidebarStatus(selectedAncestor, locale)
    : undefined
  const rowStatus =
    selectedStatus?.status === 'archived' ||
    selectedStatus?.status === 'unpublished'
      ? selectedStatus
      : displayStatus
  const isArchived = rowStatus?.status === 'archived'
  const isUnpublished = rowStatus?.status === 'unpublished'
  const isUntranslated = displayStatus?.status === 'untranslated'
  const link = entryLink?.(data)
  return (
    <TreeItem
      id={item.id}
      title={data.title}
      hasChildItems={data.hasChildren}
      icon={configuredIcon ?? (data.hasChildren ? LucideFolder : LucideFile)}
      href={link ? dashboardHref(link.href) : undefined}
      className={styles.SidebarTree.item({
        archived: isArchived,
        groupEnd: groupEnd && selectedAncestor !== undefined,
        parentSelected: selectedAncestor !== undefined,
        unpublished: isUnpublished,
        untranslated: isUntranslated
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
            <Icon
              icon={displayStatus.icon}
              className={styles.SidebarTree.status.icon()}
            />
          </span>
        ) : undefined
      }
      items={item.children}
    >
      {children}
    </TreeItem>
  )
})

interface SidebarTreeLink {
  href: string
}

function documentPath(): string {
  return typeof window === 'undefined'
    ? ''
    : `${window.location.pathname}${window.location.search}`
}

function dashboardHref(href: string): string {
  return `${documentPath()}#${href}`
}

function equalStringSets(left: Set<string>, right: Set<string>): boolean {
  return (
    left.size === right.size &&
    Array.from(left).every(value => right.has(value))
  )
}

const treeRowHeight = 34

/** The last visible descendant of an entry, if it is expanded */
function lastVisibleDescendant(
  items: Array<RootTreeNode>,
  id: string | undefined
): string | undefined {
  for (const item of items) {
    if (item.id === id) {
      let last = item.children.at(-1)
      while (last?.children.length) last = last.children.at(-1)
      return last?.id
    }
    const found = lastVisibleDescendant(item.children, id)
    if (found) return found
  }
  return undefined
}

function visibleRowIds(items: Array<RootTreeNode>): Array<string> {
  return items.flatMap(item => [item.id, ...visibleRowIds(item.children)])
}

/**
 * Scroll a newly selected entry into view. Rows are virtualized so the
 * selected row might not be rendered, its offset follows from the fixed row
 * height instead.
 */
function useScrollSelectedIntoView(
  treeRef: RefObject<HTMLDivElement | null>,
  snapshot: TreeSnapshot
) {
  const [selectedId] = snapshot.selectedKeys
  const rowIndex = selectedId
    ? visibleRowIds(snapshot.items).indexOf(selectedId)
    : -1
  const scrolledId = useRef<string | undefined>(undefined)
  // oxlint-disable react-you-might-not-need-an-effect/no-event-handler -- Sync the DOM scroll position with the selected entry.
  useEffect(() => {
    if (!selectedId) {
      scrolledId.current = undefined
      return
    }
    if (rowIndex === -1 || scrolledId.current === selectedId) return
    // Wait for the virtualizer to size its content before scrolling
    const frame = requestAnimationFrame(() => {
      const element = treeRef.current
      if (!element) return
      scrolledId.current = selectedId
      const top = rowIndex * treeRowHeight
      // Leave partially visible rows alone so a click does not move the tree
      const isVisible =
        top + treeRowHeight > element.scrollTop &&
        top < element.scrollTop + element.clientHeight
      if (isVisible) return
      element.scrollTop = top - (element.clientHeight - treeRowHeight) / 2
    })
    return () => cancelAnimationFrame(frame)
  }, [rowIndex, selectedId, treeRef])
  /* oxlint-enable react-you-might-not-need-an-effect/no-event-handler */
}

/** Drag entries within the tree and drop entries from elsewhere on it */
function useRootTreeDragDrop(
  root: RootAtoms,
  tree: TreeAtoms,
  disabled = false
): DragDropProps {
  const dragDisabled = useAtomValueRaw(root.dragDisabled)
  const getItems = useSetAtom(root.getItems)
  const drop = useSetAtom(root.onDrop)
  const move = useSetAtom(root.onMove)
  const store = useStore()
  if (disabled || dragDisabled) return {}
  const moveInTree = (event: DragMoveEvent) => move(event, tree)
  return {
    acceptedDragTypes: root.acceptedDragTypes,
    canDrop: target =>
      treeAcceptsDrop(
        store.get(configAtom).schema,
        store.get(tree.view).entries,
        target
      ),
    getDragData: getItems,
    onDropItems: drop,
    onMove: moveInTree,
    onReorder: moveInTree
  }
}

interface SidebarTreeViewProps {
  ariaLabel: string
  dragDrop: DragDropProps
  entryLink?: (entry: RootTreeItem) => SidebarTreeLink
  locale: string | null
  onExpandedChange?: (keys: Set<string>) => void
  onLocaleChange: (locale: string) => void
  onRootPress?: () => void
  onSelectionChange: (keys: ReadonlySet<Key>) => void
  root: RootAtoms
  rootSelected: boolean
  tree: TreeAtoms
}

/** The root button and entry tree shared by the sidebar and the pickers */
function SidebarTreeView({
  ariaLabel,
  dragDrop,
  entryLink,
  locale,
  onExpandedChange,
  onLocaleChange,
  onRootPress,
  onSelectionChange,
  root,
  rootSelected,
  tree
}: SidebarTreeViewProps) {
  const label = useAtomValueRaw(root.label)
  const icon = useAtomValueRaw(root.icon)
  const i18n = useAtomValueRaw(root.i18n)
  const setExpandedKeys = useSetAtom(tree.expandedKeys)
  const view = useAtomValueRaw(tree.view)
  const {snapshot} = view
  const treeRef = useRef<HTMLDivElement>(null)
  useScrollSelectedIntoView(treeRef, snapshot)
  const selectedItem = useAtomValueRaw(tree.selectedItem)
  const groupEnd = lastVisibleDescendant(snapshot.items, selectedItem?.id)
  function renderItem(item: RootTreeNode): ReactNode {
    const data = view.entries.get(item.id)
    if (!data) return null
    return (
      <SidebarTreeItem
        data={data}
        entryLink={entryLink}
        groupEnd={item.id === groupEnd}
        item={item}
        locale={locale}
        selectedItem={selectedItem}
      >
        {renderItem}
      </SidebarTreeItem>
    )
  }

  return (
    <SidebarContent>
      <div className={styles.SidebarTree.tree()}>
        <div className={styles.SidebarTree.root()}>
          <div
            className={styles.SidebarTree.rootButton({selected: rootSelected})}
          >
            <Button
              variant="ghost"
              // Entries link to their page, so the selected root is the page
              aria-current={entryLink && rootSelected ? 'page' : undefined}
              className={styles.SidebarTree.rootButton.action()}
              icon={icon}
              onClick={onRootPress}
            >
              <span className={styles.SidebarTree.rootButton.label()}>
                {label}
              </span>
            </Button>
            {i18n && i18n.locales.length > 0 && (
              <span className={styles.SidebarTree.rootButton.locale()}>
                <LocaleMenu
                  root={root}
                  locale={locale}
                  onLocaleChange={onLocaleChange}
                />
              </span>
            )}
          </div>
        </div>
        <div className={styles.SidebarTree.tree.viewport()}>
          <Tree
            ref={treeRef}
            aria-label={ariaLabel}
            items={snapshot.items}
            {...dragDrop}
            virtualized
            rowHeight={treeRowHeight}
            selectionMode="single"
            expandedKeys={snapshot.expandedKeys}
            onExpandedChange={keys => {
              const next = new Set([...keys].map(String))
              setExpandedKeys(current =>
                equalStringSets(current, next) ? current : next
              )
              onExpandedChange?.(next)
            }}
            selectedKeys={snapshot.selectedKeys}
            onSelectionChange={keys => {
              if (keys !== 'all') onSelectionChange(keys)
            }}
          >
            {renderItem}
          </Tree>
        </div>
      </div>
    </SidebarContent>
  )
}

export const SidebarTree = memo(function SidebarTree({
  page,
  root
}: SidebarTreeProps) {
  const {locale} = page
  const tree = root.tree(locale)
  const selectedItem = useAtomValueRaw(tree.selectedItem)
  const setRoute = useSetAtom(routeAtom)
  const setExpandedKeys = useSetAtom(tree.expandedKeys)
  const setCollapsed = useSetAtom(tree.collapsedKeys)
  const dragDrop = useRootTreeDragDrop(root, tree)
  function entryLink(entry: RootTreeItem): SidebarTreeLink {
    return {
      href: nav.entry(
        root.workspace,
        root.key,
        entry.id,
        page.locale,
        entry.type === 'MediaLibrary' ? undefined : 'edit'
      )
    }
  }
  return (
    <SidebarTreeView
      ariaLabel="Content tree"
      dragDrop={dragDrop}
      entryLink={entryLink}
      locale={locale}
      root={root}
      rootSelected={!page.entry}
      tree={tree}
      onRootPress={() =>
        setRoute({
          workspace: root.workspace,
          root: root.key,
          locale: page.locale ?? undefined
        })
      }
      onLocaleChange={locale =>
        setRoute({
          workspace: root.workspace,
          root: root.key,
          entry: page.entry,
          locale
        })
      }
      onExpandedChange={next =>
        setCollapsed(current => {
          const result = new Set(
            current.selectedId === selectedItem?.id ? current.keys : []
          )
          for (const id of next) result.delete(id)
          for (const id of selectedItem?.parents ?? []) {
            if (!next.has(id)) result.add(id)
          }
          const selectedId = selectedItem?.id
          return current.selectedId === selectedId &&
            equalStringSets(current.keys, result)
            ? current
            : {selectedId, keys: result}
        })
      }
      onSelectionChange={keys => {
        const [entry] = keys
        if (!entry || String(entry) === page.entry) return
        setExpandedKeys(current => new Set(current).add(String(entry)))
        setRoute({
          workspace: root.workspace,
          root: root.key,
          entry: String(entry),
          locale: page.locale ?? undefined,
          view: 'edit'
        })
      }}
    />
  )
})

export const SidebarTreeExplorer = memo(function SidebarTreeExplorer({
  ariaLabel = 'Explorer folders',
  disableDragAndDrop = true,
  onRootPress,
  onSelectionChange,
  root,
  rootSelected = false,
  selectedLocale,
  tree
}: SidebarTreeExplorerProps) {
  const [locale, setLocale] = useAtom(selectedLocale)
  const setExpandedKeys = useSetAtom(tree.expandedKeys)
  const dragDrop = useRootTreeDragDrop(root, tree, disableDragAndDrop)
  return (
    <SidebarTreeView
      ariaLabel={ariaLabel}
      dragDrop={dragDrop}
      locale={locale}
      root={root}
      rootSelected={rootSelected}
      tree={tree}
      onRootPress={onRootPress}
      onLocaleChange={setLocale}
      onSelectionChange={keys => {
        const [selected] = keys
        if (selected)
          setExpandedKeys(current => new Set(current).add(String(selected)))
        onSelectionChange?.(keys)
      }}
    />
  )
})
