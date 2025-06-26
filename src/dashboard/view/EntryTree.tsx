import styler from '@alinea/styler'
import {
  type AsyncDataLoaderDataRef,
  type FeatureImplementation,
  type ItemInstance,
  asyncDataLoaderFeature,
  dragAndDropFeature,
  propMemoizationFeature,
  selectionFeature
} from '@headless-tree/core'
import {useTree} from '@headless-tree/react'
import {getType} from 'alinea/core/Internal'
import {IndexEvent} from 'alinea/core/db/IndexEvent'
import {assert} from 'alinea/core/source/Utils'
import {debounce} from 'alinea/core/util/Debounce'
import {Icon, px} from 'alinea/ui'
import {IcOutlineArchive} from 'alinea/ui/icons/IcOutlineArchive'
import {IcRoundEdit} from 'alinea/ui/icons/IcRoundEdit'
import {IcRoundKeyboardArrowDown} from 'alinea/ui/icons/IcRoundKeyboardArrowDown'
import {IcRoundKeyboardArrowRight} from 'alinea/ui/icons/IcRoundKeyboardArrowRight'
import {IcRoundTranslate} from 'alinea/ui/icons/IcRoundTranslate'
import {IcTwotoneFolder} from 'alinea/ui/icons/IcTwotoneFolder'
import {IcTwotoneInsertDriveFile} from 'alinea/ui/icons/IcTwotoneInsertDriveFile'
import {RiFlashlightFill} from 'alinea/ui/icons/RiFlashlightFill'
import {useAtomValue} from 'jotai'
import type {HTMLProps} from 'react'
import {memo, useEffect, useLayoutEffect, useMemo, useRef} from 'react'
import {dbAtom} from '../atoms/DbAtoms.js'
import {
  type EntryTreeItem,
  ROOT_ID,
  useEntryTreeProvider
} from '../atoms/EntryAtoms.js'
import {useConfig} from '../hook/UseConfig.js'
import {useLocale} from '../hook/UseLocale.js'
import {useNav} from '../hook/UseNav.js'
import {useRoot} from '../hook/UseRoot.js'
import {useNavigate} from '../util/HashRouter.js'
import css from './EntryTree.module.scss'

const styles = styler(css)

function selectedEntry(locale: string | null, item: EntryTreeItem) {
  return item.entries.find(entry => entry.locale === locale) ?? item.entries[0]
}

interface TreeItemProps extends HTMLProps<HTMLDivElement> {
  id: string
  title: string
  type: string
  locale: string | null
  isSelected: boolean
  isDraft: boolean
  isFolder: boolean
  isExpanded: boolean
  isUntranslated: boolean
  isArchived: boolean
  isUnpublished: boolean
  isParentSelected: boolean
  isDragTarget: boolean
  isDragTargetAbove: boolean
  isDragTargetBelow: boolean
  hasChildren: boolean
  toggleExpand: () => void
  level: number
}

const TreeItem = memo(function TreeItem({
  id,
  title,
  type,
  locale,
  isSelected,
  isDraft,
  isFolder,
  isExpanded,
  isArchived,
  isUnpublished,
  isUntranslated,
  isParentSelected,
  isDragTarget,
  isDragTargetAbove,
  isDragTargetBelow,
  hasChildren,
  toggleExpand,
  level,
  ...props
}: TreeItemProps) {
  const outerRef = useRef<HTMLDivElement>(null)
  const {schema} = useConfig()
  const {icon} = getType(schema[type])
  useLayoutEffect(() => {
    if (!isSelected) return
    const el = outerRef?.current
    if (!el) return
    el.scrollIntoView({
      block: 'nearest',
      inline: 'nearest'
    })
  }, [isSelected])
  const canExpand = Boolean(isFolder && hasChildren)
  return (
    <div
      {...props}
      ref={outerRef}
      className={styles.tree.item({
        selected: isSelected,
        plain: !canExpand,
        archived: isArchived,
        unpublished: !isUntranslated && isUnpublished,
        untranslated: isUntranslated,
        drop: isDragTarget,
        dropAbove: isDragTargetAbove,
        dropBelow: isDragTargetBelow,
        parentSelected: isParentSelected
      })}
      key={id}
      data-id={id}
      style={{paddingLeft: px(level * 14 + 8)}}
    >
      <button
        type="button"
        className={styles.tree.item.arrow()}
        onClick={event => {
          event.stopPropagation()
          toggleExpand()
        }}
      >
        {canExpand &&
          (isExpanded ? (
            <Icon icon={IcRoundKeyboardArrowDown} size={14} />
          ) : (
            <Icon icon={IcRoundKeyboardArrowRight} size={14} />
          ))}
      </button>
      <button type="button" className={styles.tree.item.label()} title={title}>
        {
          <span className={styles.tree.item.icon()}>
            <Icon
              icon={
                icon ?? (isFolder ? IcTwotoneFolder : IcTwotoneInsertDriveFile)
              }
            />
          </span>
        }

        <span className={styles.tree.item.label.itemName()}>{title}</span>

        {!isUntranslated && !isUnpublished && isDraft && (
          <span className={styles.tree.status({draft: true})}>
            <Icon icon={IcRoundEdit} />
          </span>
        )}

        {!isUntranslated && isArchived && (
          <span className={styles.tree.status({archived: true})}>
            <Icon icon={IcOutlineArchive} />
          </span>
        )}

        {!isUntranslated && isUnpublished && (
          <span className={styles.tree.status({unpublished: true})}>
            <Icon icon={RiFlashlightFill} />
          </span>
        )}

        {isUntranslated && (
          <span className={styles.tree.status({untranslated: true})}>
            <Icon icon={IcRoundTranslate} />
          </span>
        )}
      </button>
    </div>
  )
})

export interface EntryTreeProps {
  selectedId?: string
  expanded?: Array<string>
}

export function EntryTree({selectedId, expanded = []}: EntryTreeProps) {
  const db = useAtomValue(dbAtom)
  const treeProvider = useEntryTreeProvider()
  const navigate = useNavigate()
  const nav = useNav()
  const navRef = useRef(nav)
  navRef.current = nav
  const customClickBehavior = useMemo((): FeatureImplementation => {
    return {
      itemInstance: {
        getProps: ({item}) => ({
          onClick: (e: MouseEvent) => {
            if (item.isSelected() && item.isFolder() && item.isExpanded()) {
              item.collapse()
            } else if (item.isFolder() && !item.isExpanded()) {
              item.expand()
            }
            item.setFocused()
            navigate(navRef.current.entry({id: item.getId()}))
          }
        })
      }
    }
  }, [])
  const locale = useLocale()
  const tree = useTree<EntryTreeItem>({
    rootItemId: ROOT_ID,
    canDrag: items => treeProvider.canDrag(items),
    canDrop(items, target) {
      return treeProvider.canDrop(items, target)
    },
    onDrop(items, target) {
      return treeProvider.onDrop(items, target)
    },
    dataLoader: treeProvider,
    getItemName: item => selectedEntry(locale, item.getItemData()).title,
    isItemFolder: item => Boolean(item.getItemData().isFolder),
    initialState: {
      expandedItems: [...expanded].concat(selectedId ?? [])
    },
    state: {
      selectedItems: selectedId ? [selectedId] : []
    },
    features: [
      asyncDataLoaderFeature,
      selectionFeature,
      dragAndDropFeature,
      customClickBehavior,
      propMemoizationFeature
      // hotkeysCoreFeature
    ]
  })

  const reload = debounce(treeProvider => {
    const data = tree.getDataRef<AsyncDataLoaderDataRef>()
    const parentIds = data.current.childrenIds
      ? Object.keys(data.current.childrenIds)
      : []
    const itemIds = data.current.itemData
      ? Object.keys(data.current.itemData)
      : []
    const tasks = parentIds
      .map(async parentId => {
        try {
          const children = await treeProvider.getChildren(parentId)
          data.current.childrenIds[parentId] = children
        } catch {
          delete data.current.childrenIds[parentId]
        }
      })
      .concat(
        itemIds.map(async itemId => {
          try {
            const item = await treeProvider.getItem(itemId)
            data.current.itemData[itemId] = item
          } catch {
            delete data.current.itemData[itemId]
          }
        })
      )
    Promise.all(tasks).then(() => {
      tree.rebuildTree()
    })
  }, 0)

  const root = useRoot()

  useEffect(() => {
    const data = tree.getDataRef<AsyncDataLoaderDataRef>()
    data.current.childrenIds[ROOT_ID] = []
    tree.rebuildTree()
  }, [root])

  useEffect(() => {
    reload(treeProvider)
  }, [treeProvider])

  useEffect(() => {
    db.events.addEventListener(IndexEvent.type, listen)
    return () => db.events.removeEventListener(IndexEvent.type, listen)
    function listen(event: Event) {
      assert(event instanceof IndexEvent)
      if (event.data.op === 'index') {
        reload(treeProvider)
      }
    }
  }, [db, treeProvider])

  const loaded = tree.getItems().filter(item => item.getItemData())
  return (
    <>
      <div {...tree.getContainerProps()} className={styles.tree()}>
        {loaded.map(item => {
          const id = item.getId()
          const data = item.getItemData()
          const title = item.getItemName()
          const selected = selectedEntry(locale, data)
          let isParentSelected = false
          let current: ItemInstance<EntryTreeItem> | undefined =
            item.getParent()
          while (current && !isParentSelected) {
            if (!current.isSelected()) current = current.getParent()
            else isParentSelected = true
          }
          return (
            <TreeItem
              key={id}
              id={id}
              type={data.type}
              locale={selected.locale}
              title={title}
              isSelected={selectedId === id}
              isDraft={selected.status === 'draft'}
              isFolder={item.isFolder()}
              isExpanded={item.isExpanded()}
              isUntranslated={selected.locale !== locale}
              isArchived={selected.status === 'archived'}
              isUnpublished={selected.status === 'draft' && selected.main}
              isDragTarget={item.isDragTarget() && item.isDraggingOver()}
              isDragTargetAbove={
                item.isDragTargetAbove() && item.isDraggingOver()
              }
              isParentSelected={isParentSelected}
              isDragTargetBelow={
                item.isDragTargetBelow() && item.isDraggingOver()
              }
              hasChildren={data.hasChildren}
              toggleExpand={item.isExpanded() ? item.collapse : item.expand}
              level={item.getItemMeta().level}
              {...item.getProps()}
            />
          )
        })}
      </div>
    </>
  )
}
