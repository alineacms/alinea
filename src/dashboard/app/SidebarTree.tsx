import {Button, Icon, Tree, TreeItem} from '#/components.js'
import {typeAtoms} from '#/dashboard/atoms/config.js'
import type {Page} from '#/dashboard/atoms/nav.js'
import {routeAtom} from '#/dashboard/atoms/nav.js'
import type {RootAtoms, RootTreeItem} from '#/dashboard/atoms/root.js'
import styler from '@alinea/styler'
import {atom, useAtom, useAtomValue, useSetAtom, type WritableAtom} from 'jotai'
import {memo, useEffect, useMemo, useState, type ComponentType} from 'react'
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
  selectedLocale?: WritableAtom<string | null, [string], unknown>
}

interface SidebarStatusDisplay {
  icon: ComponentType
  label: string
  status: 'draft' | 'unpublished' | 'archived' | 'untranslated'
}

function sidebarStatus(
  item: RootTreeItem,
  locale: string | null | undefined
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

interface SidebarItemProps {
  item: RootTreeItem
  items: Array<RootTreeItem>
  locale: string | null | undefined
  selectedId?: string
}

export const SidebarTreeItem = memo(function SidebarTreeItem({
  item,
  items,
  locale,
  selectedId
}: SidebarItemProps) {
  const children = items.filter(candidate => candidate.parentId === item.id)
  const displayStatus = sidebarStatus(item, locale)
  const configuredIcon = useAtomValue(typeAtoms(item.type)).icon
  const selectedAncestor = selectedId
    ? items.find(
        candidate =>
          candidate.id === selectedId && item.parents.includes(candidate.id)
      )
    : undefined
  const selectedAncestorStatus = selectedAncestor
    ? sidebarStatus(selectedAncestor, locale)
    : undefined
  const rowStatus =
    selectedAncestorStatus?.status === 'archived' ||
    selectedAncestorStatus?.status === 'unpublished'
      ? selectedAncestorStatus
      : displayStatus
  const isArchived = rowStatus?.status === 'archived'
  const isUnpublished = rowStatus?.status === 'unpublished'
  const isUntranslated = displayStatus?.status === 'untranslated'
  return (
    <TreeItem
      id={item.id}
      textValue={item.title}
      title={item.title}
      hasChildItems={item.hasChildren}
      icon={configuredIcon ?? (item.hasChildren ? LucideFolder : LucideFile)}
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
    >
      {children.length > 0 && (
        <Collection items={children}>
          {child => (
            <SidebarTreeItem
              item={child}
              items={items}
              locale={locale}
              selectedId={selectedId}
            />
          )}
        </Collection>
      )}
    </TreeItem>
  )
})

const treeLayoutOptions = {rowHeight: 32, padding: 0, gap: 0}

export const SidebarTree = memo(function SidebarTree({
  page,
  root
}: SidebarTreeProps) {
  const items = useAtomValue(root.treeItems)
  const label = useAtomValue(root.label)
  const icon = useAtomValue(root.icon)
  const i18n = useAtomValue(root.i18n)
  const selectedLocale = useAtomValue(root.selectedLocale)
  const setRoute = useSetAtom(routeAtom)
  const [expandedIds, setExpandedIds] = useAtom(root.treeExpandedKeys)
  const expandedKeys = useMemo<Set<Key>>(
    () => new Set(expandedIds),
    [expandedIds]
  )
  const rootItems = items.filter(item => item.parentId === null)
  const selectedKeys = page.entry ? new Set<Key>([page.entry]) : new Set<Key>()
  const dragDisabled = useAtomValue(root.dragDisabled)
  const getItems = useSetAtom(root.getItems)
  const getDropOperation = useSetAtom(root.getDropOperation)
  const onInsert = useSetAtom(root.onInsert)
  const onItemDrop = useSetAtom(root.onItemDrop)
  const onMove = useSetAtom(root.onMove)
  const {dragAndDropHooks} = useDragAndDrop<RootTreeItem>({
    acceptedDragTypes: root.acceptedDragTypes,
    getItems,
    isDisabled: dragDisabled,
    getDropOperation,
    onInsert,
    onItemDrop,
    onMove
  })

  const selectedParents = useMemo(() => {
    const result = new Set<Key>()
    let current = items.find(item => item.id === page.entry)
    while (current?.parentId) {
      result.add(current.parentId)
      current = items.find(item => item.id === current?.parentId)
    }
    return result
  }, [items, page.entry])

  useEffect(() => {
    if (selectedParents.size > 0)
      setExpandedIds(
        current => new Set([...current, ...selectedParents].map(String))
      )
  }, [selectedParents, setExpandedIds])

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
                <LocaleMenu root={root} />
              </span>
            )}
          </div>
        </div>
        <div className={styles.SidebarTree.tree.viewport()}>
          <Virtualizer layout={ListLayout} layoutOptions={treeLayoutOptions}>
            <Tree
              aria-label="Content tree"
              items={rootItems}
              dragAndDropHooks={dragAndDropHooks}
              selectionMode="single"
              selectionBehavior="replace"
              disallowEmptySelection={false}
              expandedKeys={expandedKeys}
              onExpandedChange={keys =>
                setExpandedIds(new Set([...keys].map(String)))
              }
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
                    locale: page.locale ?? undefined
                  })
                }
              }}
            >
              {item => (
                <SidebarTreeItem
                  item={item}
                  items={items}
                  locale={selectedLocale}
                  selectedId={page.entry}
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
  selectedLocale = root.selectedLocale
}: SidebarTreeExplorerProps) {
  const items = useAtomValue(root.treeItems)
  const label = useAtomValue(root.label)
  const icon = useAtomValue(root.icon)
  const i18n = useAtomValue(root.i18n)
  const locale = useAtomValue(selectedLocale)
  const [expandedIdsAtom] = useState(() => atom(new Set<string>()))
  const [expandedIds, setExpandedIds] = useAtom(expandedIdsAtom)
  const expandedKeys = new Set<Key>(expandedIds)
  const rootItems = items.filter(item => item.parentId === null)
  const dragDisabled = useAtomValue(root.dragDisabled)
  const getItems = useSetAtom(root.getItems)
  const getDropOperation = useSetAtom(root.getDropOperation)
  const onInsert = useSetAtom(root.onInsert)
  const onItemDrop = useSetAtom(root.onItemDrop)
  const onMove = useSetAtom(root.onMove)
  const {dragAndDropHooks} = useDragAndDrop<RootTreeItem>({
    acceptedDragTypes: root.acceptedDragTypes,
    getItems,
    isDisabled: disableDragAndDrop || dragDisabled,
    getDropOperation,
    onInsert,
    onItemDrop,
    onMove
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
                <LocaleMenu root={root} selectedLocale={selectedLocale} />
              </span>
            )}
          </div>
        </div>
        <div className={styles.SidebarTree.tree.viewport()}>
          <Virtualizer layout={ListLayout} layoutOptions={treeLayoutOptions}>
            <Tree
              aria-label={ariaLabel}
              items={rootItems}
              dragAndDropHooks={dragAndDropHooks}
              selectionMode="single"
              selectionBehavior="replace"
              disallowEmptySelection={false}
              expandedKeys={expandedKeys}
              onExpandedChange={keys =>
                setExpandedIds(new Set([...keys].map(String)))
              }
              selectedKeys={selectedKeys}
              onSelectionChange={onSelectionChange}
            >
              {item => (
                <SidebarTreeItem item={item} items={items} locale={locale} />
              )}
            </Tree>
          </Virtualizer>
        </div>
      </div>
    </SidebarBody>
  )
})
