import {Button, Icon, Tree, TreeItem} from '#/components.js'
import {typeAtoms} from '#/dashboard/atoms/config.js'
import {nav, routeAtom, type Page} from '#/dashboard/atoms/nav.js'
import type {
  RootAtoms,
  RootTreeItem,
  RootTreeNode,
  TreeAtoms,
  TreeSnapshot
} from '#/dashboard/atoms/root.js'
import styler from '@alinea/styler'
import {useAtom, useAtomValueRaw, useSetAtom, type WritableAtom} from 'jotai'
import {
  memo,
  type ComponentType,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef
} from 'react'
import {
  Collection,
  ListLayout,
  useDragAndDrop,
  Virtualizer,
  type Selection
} from 'react-aria-components'
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
import {SidebarBody} from './ui/Sidebar.js'

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
  children?: ReactNode
  data: RootTreeItem
  entryLink?: (entry: RootTreeItem) => SidebarTreeLink
  item: RootTreeNode
  locale: string | null
  selectedItem?: RootTreeItem
}

export const SidebarTreeItem = memo(function SidebarTreeItem({
  children,
  data,
  entryLink,
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
      disableDragging={data.dragDisabled}
      title={data.title}
      hasChildItems={data.hasChildren}
      icon={configuredIcon ?? (data.hasChildren ? LucideFolder : LucideFile)}
      iconHref={link ? dashboardHref(link.href) : undefined}
      className={styles.SidebarTree.item({
        archived: isArchived,
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
            <Icon icon={displayStatus.icon} />
          </span>
        ) : undefined
      }
      label={
        link ? (
          <SidebarTreeEntryLink href={link.href} title={data.title} />
        ) : (
          data.title
        )
      }
    >
      {children}
    </TreeItem>
  )
})

interface SidebarTreeEntryLinkProps {
  href: string
  title: string
}

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

function SidebarTreeEntryLink({href, title}: SidebarTreeEntryLinkProps) {
  return (
    <a className={styles.SidebarTree.entryLink()} href={dashboardHref(href)}>
      {title}
    </a>
  )
}

function equalStringSets(left: Set<string>, right: Set<string>): boolean {
  return (
    left.size === right.size &&
    Array.from(left).every(value => right.has(value))
  )
}

const treeLayoutOptions = {rowHeight: 32, padding: 0, gap: 0}

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
      const {rowHeight} = treeLayoutOptions
      const top = rowIndex * rowHeight
      // Leave partially visible rows alone so a click does not move the tree
      const isVisible =
        top + rowHeight > element.scrollTop &&
        top < element.scrollTop + element.clientHeight
      if (isVisible) return
      element.scrollTop = top - (element.clientHeight - rowHeight) / 2
    })
    return () => cancelAnimationFrame(frame)
  }, [rowIndex, selectedId, treeRef])
  /* oxlint-enable react-you-might-not-need-an-effect/no-event-handler */
}

export const SidebarTree = memo(function SidebarTree({
  page,
  root
}: SidebarTreeProps) {
  const {locale} = page
  const tree = root.tree(locale)
  const view = useAtomValueRaw(tree.view)
  const {snapshot} = view
  const treeRef = useRef<HTMLDivElement>(null)
  useScrollSelectedIntoView(treeRef, snapshot)
  const selectedItem = useAtomValueRaw(tree.selectedItem)
  const label = useAtomValueRaw(root.label)
  const icon = useAtomValueRaw(root.icon)
  const i18n = useAtomValueRaw(root.i18n)
  const setRoute = useSetAtom(routeAtom)
  const setExpandedKeys = useSetAtom(tree.expandedKeys)
  const [collapsed, setCollapsed] = useAtom(tree.collapsedKeys)
  const dragDisabled = useAtomValueRaw(root.dragDisabled)
  const getItems = useSetAtom(root.getItems)
  const getDropOperation = useSetAtom(root.getDropOperation)
  const drop = useSetAtom(root.onDrop)
  const move = useSetAtom(root.onMove)
  const {dragAndDropHooks} = useDragAndDrop<RootTreeNode>({
    acceptedDragTypes: root.acceptedDragTypes,
    getItems,
    isDisabled: dragDisabled,
    getDropOperation,
    onInsert: drop,
    onItemDrop: drop,
    onMove: event => move(event, tree)
  })
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
  function renderItem(item: RootTreeNode): ReactNode {
    const data = view.entries.get(item.id)
    if (!data) return null
    return (
      <SidebarTreeItem
        data={data}
        entryLink={entryLink}
        item={item}
        locale={locale}
        selectedItem={selectedItem}
      >
        <Collection items={item.children}>{renderItem}</Collection>
      </SidebarTreeItem>
    )
  }

  return (
    <SidebarBody>
      <div className={styles.SidebarTree.tree()}>
        <div className={styles.SidebarTree.root()}>
          <div
            className={styles.SidebarTree.rootButton({selected: !page.entry})}
          >
            <Button
              variant="ghost"
              aria-current={!page.entry ? 'page' : undefined}
              className={styles.SidebarTree.rootButton.action()}
              icon={icon}
              onClick={() =>
                setRoute({
                  workspace: root.workspace,
                  root: root.key,
                  locale: page.locale ?? undefined
                })
              }
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
                  onLocaleChange={locale =>
                    setRoute({
                      workspace: root.workspace,
                      root: root.key,
                      entry: page.entry,
                      locale
                    })
                  }
                />
              </span>
            )}
          </div>
        </div>
        <div className={styles.SidebarTree.tree.viewport()}>
          <Virtualizer layout={ListLayout} layoutOptions={treeLayoutOptions}>
            <Tree
              ref={treeRef}
              aria-label="Content tree"
              items={snapshot.items}
              dragAndDropHooks={dragAndDropHooks}
              selectionMode="single"
              selectionBehavior="replace"
              disallowEmptySelection={false}
              expandedKeys={snapshot.expandedKeys}
              onExpandedChange={keys => {
                const next = new Set([...keys].map(String))
                setExpandedKeys(current =>
                  equalStringSets(current, next) ? current : next
                )
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
              }}
              selectedKeys={snapshot.selectedKeys}
              onSelectionChange={keys => {
                if (keys === 'all') return
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
            >
              {renderItem}
            </Tree>
          </Virtualizer>
        </div>
      </div>
    </SidebarBody>
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
  const label = useAtomValueRaw(root.label)
  const icon = useAtomValueRaw(root.icon)
  const i18n = useAtomValueRaw(root.i18n)
  const setExpandedKeys = useSetAtom(tree.expandedKeys)
  const view = useAtomValueRaw(tree.view)
  const {snapshot} = view
  const treeRef = useRef<HTMLDivElement>(null)
  useScrollSelectedIntoView(treeRef, snapshot)
  const selectedItem = useAtomValueRaw(tree.selectedItem)
  const dragDisabled = useAtomValueRaw(root.dragDisabled)
  const getItems = useSetAtom(root.getItems)
  const getDropOperation = useSetAtom(root.getDropOperation)
  const drop = useSetAtom(root.onDrop)
  const move = useSetAtom(root.onMove)
  const {dragAndDropHooks} = useDragAndDrop<RootTreeNode>({
    acceptedDragTypes: root.acceptedDragTypes,
    getItems,
    isDisabled: disableDragAndDrop || dragDisabled,
    getDropOperation,
    onInsert: drop,
    onItemDrop: drop,
    onMove: event => move(event, tree)
  })
  function renderItem(item: RootTreeNode): ReactNode {
    const data = view.entries.get(item.id)
    if (!data) return null
    return (
      <SidebarTreeItem
        data={data}
        item={item}
        locale={locale}
        selectedItem={selectedItem}
      >
        <Collection items={item.children}>{renderItem}</Collection>
      </SidebarTreeItem>
    )
  }

  return (
    <SidebarBody>
      <div className={styles.SidebarTree.tree()}>
        <div className={styles.SidebarTree.root()}>
          <div
            className={styles.SidebarTree.rootButton({selected: rootSelected})}
          >
            <Button
              variant="ghost"
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
                  onLocaleChange={setLocale}
                />
              </span>
            )}
          </div>
        </div>
        <div className={styles.SidebarTree.tree.viewport()}>
          <Virtualizer layout={ListLayout} layoutOptions={treeLayoutOptions}>
            <Tree
              ref={treeRef}
              aria-label={ariaLabel}
              items={snapshot.items}
              dragAndDropHooks={dragAndDropHooks}
              selectionMode="single"
              selectionBehavior="replace"
              disallowEmptySelection={false}
              expandedKeys={snapshot.expandedKeys}
              onExpandedChange={keys => {
                const next = new Set([...keys].map(String))
                setExpandedKeys(current =>
                  equalStringSets(current, next) ? current : next
                )
              }}
              selectedKeys={snapshot.selectedKeys}
              onSelectionChange={keys => {
                if (keys === 'all') return
                const [selected] = keys
                if (selected)
                  setExpandedKeys(current =>
                    new Set(current).add(String(selected))
                  )
                onSelectionChange?.(keys)
              }}
            >
              {renderItem}
            </Tree>
          </Virtualizer>
        </div>
      </div>
    </SidebarBody>
  )
})
