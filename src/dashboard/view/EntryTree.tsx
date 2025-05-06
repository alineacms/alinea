import styler from '@alinea/styler'
import {
  type AsyncDataLoaderDataRef,
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
import {IcOutlineDescription} from 'alinea/ui/icons/IcOutlineDescription'
import {IcRoundKeyboardArrowDown} from 'alinea/ui/icons/IcRoundKeyboardArrowDown'
import {IcRoundKeyboardArrowRight} from 'alinea/ui/icons/IcRoundKeyboardArrowRight'
import {IcRoundTranslate} from 'alinea/ui/icons/IcRoundTranslate'
import {IcRoundVisibilityOff} from 'alinea/ui/icons/IcRoundVisibilityOff'
import {useAtomValue} from 'jotai'
import type {HTMLProps} from 'react'
import {forwardRef, memo, useEffect, useLayoutEffect, useRef} from 'react'
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
  isFolder: boolean
  isExpanded: boolean
  isUntranslated: boolean
  isUnpublished: boolean
  isDragTarget: boolean
  isDragTargetAbove: boolean
  isDragTargetBelow: boolean
  level: number
}

const TreeItem = memo(
  forwardRef<HTMLDivElement, TreeItemProps>(function TreeItem(
    {
      id,
      title,
      type,
      locale,
      isSelected,
      isFolder,
      isExpanded,
      isUnpublished,
      isUntranslated,
      isDragTarget,
      isDragTargetAbove,
      isDragTargetBelow,
      level,
      ...props
    }: TreeItemProps,
    innerRef
  ) {
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
    return (
      <div ref={outerRef}>
        <div
          {...props}
          ref={innerRef}
          className={styles.tree.item({
            selected: isSelected,
            unpublished: isUnpublished,
            untranslated: isUntranslated,
            drop: isDragTarget,
            dropAbove: isDragTargetAbove,
            dropBelow: isDragTargetBelow
          })}
          key={id}
          data-id={id}
        >
          <button
            type="button"
            className={styles.tree.item.label()}
            title={title}
            style={{paddingLeft: px((level + 1) * 12)}}
          >
            <span className={styles.tree.item.icon()}>
              <Icon
                icon={
                  isUntranslated
                    ? IcRoundTranslate
                    : isUnpublished
                      ? IcRoundVisibilityOff
                      : (icon ?? IcOutlineDescription)
                }
              />
            </span>

            <span className={styles.tree.item.label.itemName()}>{title}</span>

            {isFolder && (
              <span className={styles.tree.item.arrow()}>
                {isExpanded ? (
                  <Icon icon={IcRoundKeyboardArrowDown} size={18} />
                ) : (
                  <Icon icon={IcRoundKeyboardArrowRight} size={18} />
                )}
              </span>
            )}
          </button>
        </div>
      </div>
    )
  })
)

export interface EntryTreeProps {
  selectedId?: string
  expanded?: Array<string>
}

export function EntryTree({selectedId, expanded = []}: EntryTreeProps) {
  const db = useAtomValue(dbAtom)
  const {schema} = useConfig()
  const treeProvider = useEntryTreeProvider()
  const navigate = useNavigate()
  const nav = useNav()
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
    onPrimaryAction: item => {
      navigate(nav.entry({id: item.getId()}))
    },
    initialState: {
      expandedItems: expanded
    },
    state: {
      selectedItems: selectedId ? [selectedId] : []
    },
    features: [
      asyncDataLoaderFeature,
      selectionFeature,
      dragAndDropFeature,
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
          return (
            <TreeItem
              key={id}
              id={id}
              type={data.type}
              locale={selected.locale}
              title={title}
              isSelected={selectedId === id}
              isFolder={item.isFolder()}
              isExpanded={item.isExpanded()}
              isUntranslated={selected.locale !== locale}
              isUnpublished={selected.status === 'archived'}
              isDragTarget={item.isDragTarget() && item.isDraggingOver()}
              isDragTargetAbove={
                item.isDragTargetAbove() && item.isDraggingOver()
              }
              isDragTargetBelow={
                item.isDragTargetBelow() && item.isDraggingOver()
              }
              level={item.getItemMeta().level}
              {...item.getProps()}
            />
          )
        })}
      </div>
    </>
  )
}
