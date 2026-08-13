import {Button, Icon, Tree, TreeItem} from '#/components.js'
import {typeAtoms} from '#/dashboard/atoms/config.js'
import {nav, routeAtom, type Page} from '#/dashboard/atoms/nav.js'
import type {
  RootAtoms,
  RootTreeItem,
  RootTreeNode
} from '#/dashboard/atoms/root.js'
import styler from '@alinea/styler'
import {
  atom,
  type Atom,
  useAtom,
  useAtomValue,
  useSetAtom,
  type WritableAtom
} from 'jotai'
import {memo, useMemo, useRef, useState, type ComponentType} from 'react'
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
  selectedKeys?: Set<Key>
  selectedLocale: WritableAtom<string | null, [string], unknown>
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
  entryLink?: (entry: RootTreeItem) => SidebarTreeLink
  expandedKeys: Set<Key>
  item: RootTreeNode
  locale: string | null
  root: SidebarTreeSource
  selectedItem?: RootTreeItem
}

interface SidebarTreeSource {
  treeChildren(
    locale: string | null,
    parentId: string | null
  ): Atom<Array<RootTreeNode>>
  treeItem(locale: string | null, id: string): Atom<RootTreeItem>
}

export const SidebarTreeItem = memo(function SidebarTreeItem({
  entryLink,
  expandedKeys,
  item,
  locale,
  root,
  selectedItem
}: SidebarTreeItemProps) {
  const data = useAtomValue(root.treeItem(locale, item.id))
  const displayStatus = sidebarStatus(data, locale)
  const configuredIcon = useAtomValue(typeAtoms(data.type)).icon
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
        ) : undefined
      }
    >
      {expandedKeys.has(item.id) && (
        <SidebarTreeChildren
          entryLink={entryLink}
          expandedKeys={expandedKeys}
          locale={locale}
          parentId={item.id}
          root={root}
          selectedItem={selectedItem}
        />
      )}
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

function SidebarTreeEntryLink({href, title}: SidebarTreeEntryLinkProps) {
  const hashHref =
    typeof window === 'undefined'
      ? `#${href}`
      : `${window.location.href.split('#', 1)[0]}#${href}`

  return (
    <a className={styles.SidebarTree.entryLink()} href={hashHref}>
      {title}
    </a>
  )
}

interface SidebarTreeChildrenProps {
  entryLink?: (entry: RootTreeItem) => SidebarTreeLink
  expandedKeys: Set<Key>
  locale: string | null
  parentId: string
  root: SidebarTreeSource
  selectedItem?: RootTreeItem
}

const SidebarTreeChildren = memo(function SidebarTreeChildren({
  entryLink,
  expandedKeys,
  locale,
  parentId,
  root,
  selectedItem
}: SidebarTreeChildrenProps) {
  const children = useAtomValue(root.treeChildren(locale, parentId))
  return (
    <Collection items={children} dependencies={[children]}>
      {child => (
        <SidebarTreeItem
          entryLink={entryLink}
          expandedKeys={expandedKeys}
          item={child}
          locale={locale}
          root={root}
          selectedItem={selectedItem}
        />
      )}
    </Collection>
  )
})

const treeLayoutOptions = {rowHeight: 32, padding: 0, gap: 0}

function equalStringSets(left: Set<string>, right: Set<string>): boolean {
  return (
    left.size === right.size &&
    Array.from(left).every(value => right.has(value))
  )
}

function useSelectedParentIds(selectedItem: RootTreeItem | undefined) {
  const selected = useRef<{
    id: string | undefined
    parents: Set<string>
  }>()
  if (!selected.current || selected.current.id !== selectedItem?.id) {
    selected.current = {
      id: selectedItem?.id,
      parents: new Set(selectedItem?.parents ?? [])
    }
  }
  return selected.current.parents
}

export const SidebarTree = memo(function SidebarTree({
  page,
  root
}: SidebarTreeProps) {
  const {locale} = page
  const rootItems = useAtomValue(root.treeChildren(locale, null))
  const selectedItem = useAtomValue(root.selectedTreeItem(locale, page.entry))
  const label = useAtomValue(root.label)
  const icon = useAtomValue(root.icon)
  const i18n = useAtomValue(root.i18n)
  const setRoute = useSetAtom(routeAtom)
  const [expandedIds, setExpandedIds] = useAtom(root.treeExpandedKeys)
  const [collapsed, setCollapsed] = useAtom(root.treeCollapsedKeys)
  const selectedParentIds = useSelectedParentIds(selectedItem)
  const expandedKeys = useMemo<Set<Key>>(() => {
    const result = new Set<Key>(expandedIds)
    const collapsedKeys =
      collapsed.selectedId === selectedItem?.id ? collapsed.keys : undefined
    for (const parentId of selectedParentIds) {
      if (!collapsedKeys?.has(parentId)) result.add(parentId)
    }
    return result
  }, [collapsed, expandedIds, selectedItem, selectedParentIds])
  const selectedKeys = useMemo(
    () => (page.entry ? new Set<Key>([page.entry]) : new Set<Key>()),
    [page.entry]
  )
  const dragDisabled = useAtomValue(root.dragDisabled)
  const getItems = useSetAtom(root.getItems)
  const getDropOperation = useSetAtom(root.getDropOperation)
  const drop = useSetAtom(root.onDrop)
  const move = useSetAtom(root.onMove)
  const {dragAndDropHooks} = useDragAndDrop<RootTreeNode>({
    acceptedDragTypes: root.acceptedDragTypes,
    getItems,
    isDisabled: dragDisabled,
    getDropOperation,
    onInsert: event => drop(event, locale),
    onItemDrop: event => drop(event, locale),
    onMove: event => move(event, locale)
  })

  return (
    <SidebarBody>
      <div className={styles.SidebarTree.tree()}>
        <div className={styles.SidebarTree.root()}>
          <div
            className={styles.SidebarTree.rootButton({selected: !page.entry})}
          >
            <Button
              appearance="plain"
              aria-current={!page.entry ? 'page' : undefined}
              className={styles.SidebarTree.rootButton.action()}
              icon={icon}
              onPress={() =>
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
              aria-label="Content tree"
              items={rootItems}
              dependencies={[expandedKeys]}
              dragAndDropHooks={dragAndDropHooks}
              selectionMode="single"
              selectionBehavior="replace"
              disallowEmptySelection={false}
              expandedKeys={expandedKeys}
              onExpandedChange={keys => {
                const next = new Set([...keys].map(String))
                setExpandedIds(current =>
                  equalStringSets(current, next) ? current : next
                )
                setCollapsed(current => {
                  const result = new Set(
                    current.selectedId === selectedItem?.id ? current.keys : []
                  )
                  for (const id of next) result.delete(id)
                  for (const id of selectedParentIds) {
                    if (!next.has(id)) result.add(id)
                  }
                  const selectedId = selectedItem?.id
                  return current.selectedId === selectedId &&
                    equalStringSets(current.keys, result)
                    ? current
                    : {selectedId, keys: result}
                })
              }}
              selectedKeys={selectedKeys}
              onSelectionChange={keys => {
                if (keys === 'all') return
                const [entry] = keys
                if (entry) {
                  setExpandedIds(current => new Set(current).add(String(entry)))
                  setRoute({
                    workspace: root.workspace,
                    root: root.key,
                    entry: String(entry),
                    locale: page.locale ?? undefined,
                    view: 'edit'
                  })
                }
              }}
            >
              {item => (
                <SidebarTreeItem
                  entryLink={entry => {
                    const view =
                      entry.type === 'MediaLibrary' ? undefined : 'edit'
                    return {
                      href: nav.entry(
                        root.workspace,
                        root.key,
                        entry.id,
                        page.locale,
                        view
                      )
                    }
                  }}
                  expandedKeys={expandedKeys}
                  item={item}
                  locale={locale}
                  root={root}
                  selectedItem={selectedItem}
                />
              )}
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
  selectedKeys = new Set<Key>(),
  selectedLocale
}: SidebarTreeExplorerProps) {
  const [locale, setLocale] = useAtom(selectedLocale)
  const rootItems = useAtomValue(root.treeChildren(locale, null))
  const label = useAtomValue(root.label)
  const icon = useAtomValue(root.icon)
  const i18n = useAtomValue(root.i18n)
  const [expandedIdsAtom] = useState(() => atom(new Set<string>()))
  const [expandedIds, setExpandedIds] = useAtom(expandedIdsAtom)
  const selectedKey = selectedKeys.values().next().value
  const selectedId = selectedKey === undefined ? undefined : String(selectedKey)
  const selectedItem = useAtomValue(root.selectedTreeItem(locale, selectedId))
  const expandedKeys = useMemo(
    () => new Set<Key>([...expandedIds, ...(selectedItem?.parents ?? [])]),
    [expandedIds, selectedItem]
  )
  const dragDisabled = useAtomValue(root.dragDisabled)
  const getItems = useSetAtom(root.getItems)
  const getDropOperation = useSetAtom(root.getDropOperation)
  const drop = useSetAtom(root.onDrop)
  const move = useSetAtom(root.onMove)
  const {dragAndDropHooks} = useDragAndDrop<RootTreeNode>({
    acceptedDragTypes: root.acceptedDragTypes,
    getItems,
    isDisabled: disableDragAndDrop || dragDisabled,
    getDropOperation,
    onInsert: event => drop(event, locale),
    onItemDrop: event => drop(event, locale),
    onMove: event => move(event, locale)
  })
  return (
    <SidebarBody>
      <div className={styles.SidebarTree.tree()}>
        <div className={styles.SidebarTree.root()}>
          <div
            className={styles.SidebarTree.rootButton({selected: rootSelected})}
          >
            <Button
              appearance="plain"
              className={styles.SidebarTree.rootButton.action()}
              icon={icon}
              onPress={onRootPress}
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
              aria-label={ariaLabel}
              items={rootItems}
              dependencies={[expandedKeys]}
              dragAndDropHooks={dragAndDropHooks}
              selectionMode="single"
              selectionBehavior="replace"
              disallowEmptySelection={false}
              expandedKeys={expandedKeys}
              onExpandedChange={keys => {
                const next = new Set([...keys].map(String))
                setExpandedIds(current =>
                  equalStringSets(current, next) ? current : next
                )
              }}
              selectedKeys={selectedKeys}
              onSelectionChange={onSelectionChange}
            >
              {item => (
                <SidebarTreeItem
                  expandedKeys={expandedKeys}
                  item={item}
                  locale={locale}
                  root={root}
                  selectedItem={selectedItem}
                />
              )}
            </Tree>
          </Virtualizer>
        </div>
      </div>
    </SidebarBody>
  )
})
