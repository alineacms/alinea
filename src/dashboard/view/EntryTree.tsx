import {
  ItemInstance,
  asyncDataLoaderFeature,
  dragAndDropFeature,
  selectionFeature
} from '@headless-tree/core'
import {useTree} from '@headless-tree/react'
import {EntryPhase} from 'alinea/core/EntryRow'
import {Type} from 'alinea/core/Type'
import {Icon, fromModule, px} from 'alinea/ui'
import {IcOutlineDescription} from 'alinea/ui/icons/IcOutlineDescription'
import {IcRoundKeyboardArrowDown} from 'alinea/ui/icons/IcRoundKeyboardArrowDown'
import {IcRoundKeyboardArrowRight} from 'alinea/ui/icons/IcRoundKeyboardArrowRight'
import {IcRoundTranslate} from 'alinea/ui/icons/IcRoundTranslate'
import {IcRoundVisibilityOff} from 'alinea/ui/icons/IcRoundVisibilityOff'
import {useAtomValue} from 'jotai'
import {useEffect, useRef} from 'react'
import {changedEntriesAtom} from '../atoms/DbAtoms.js'
import {
  EntryTreeItem,
  rootId,
  useEntryTreeProvider
} from '../atoms/EntryAtoms.js'
import {entryLocationAtom} from '../atoms/NavigationAtoms.js'
import {useConfig} from '../hook/UseConfig.js'
import {useLocale} from '../hook/UseLocale.js'
import {useNav} from '../hook/UseNav.js'
import {useRoot} from '../hook/UseRoot.js'
import {useNavigate} from '../util/HashRouter.js'
import css from './EntryTree.module.scss'

const styles = fromModule(css)

function selectedEntry(locale: string | undefined, item: EntryTreeItem) {
  return item.entries.find(entry => entry.locale === locale) ?? item.entries[0]
}

interface EntryTreeItemProps {
  item: ItemInstance<EntryTreeItem>
  data: EntryTreeItem
}

function EntryTreeItem({item, data}: EntryTreeItemProps) {
  const {entryId} = useAtomValue(entryLocationAtom)
  const locale = useLocale()
  const {schema} = useConfig()
  const currentData = useRef<EntryTreeItem>(data)
  const itemData = data ?? currentData.current

  if (!itemData) return null
  currentData.current = itemData
  const selected = selectedEntry(locale, itemData)
  const {icon} = Type.meta(schema[selected.type])
  const isDraft = selected.phase === EntryPhase.Draft
  const isUntranslated = locale && selected.locale !== locale
  const isArchived = selected.phase === EntryPhase.Archived
  const isUnpublished = selected.phase === EntryPhase.Archived
  const isSelected = entryId && itemData.id === entryId

  return (
    <div
      {...item.getProps()}
      ref={item.registerElement}
      className={styles.tree.item({
        selected: isSelected,
        unpublished: isUnpublished,
        untranslated: isUntranslated,
        drop: item.isDropTarget() && item.isDraggingOver(),
        dropAbove: item.isDropTargetAbove() && item.isDraggingOver(),
        dropBelow: item.isDropTargetBelow() && item.isDraggingOver()
      })}
      key={item.getId()}
      data-id={item.getId()}
    >
      <button
        className={styles.tree.item.label()}
        title={selectedEntry(locale, itemData).title}
        style={{paddingLeft: px((item.getItemMeta().level + 1) * 12)}}
      >
        <span className={styles.tree.item.icon()}>
          <Icon
            icon={
              isUntranslated
                ? IcRoundTranslate
                : isUnpublished
                ? IcRoundVisibilityOff
                : icon ?? IcOutlineDescription
            }
          />
        </span>

        <span className={styles.tree.item.label.itemName()}>
          {selectedEntry(locale, itemData).title}
        </span>

        {/* {isUntranslated && (
          <span className={styles.tree.status({untranslated: true})}>
            <Icon icon={IcRoundTranslate} size={16} />
          </span>
        )} */}

        {/* {!isUntranslated && isDraft && (
          <span className={styles.tree.status({draft: true})}>
            <Icon icon={IcRoundEdit} size={16} />
          </span>
        )} */}

        {/* {!isUntranslated && isArchived && (
          <span className={styles.tree.status({archived: true})}>
            <Icon icon={IcRoundArchive} size={16} />
          </span>
        )} */}

        {item.isFolder() && (
          <span className={styles.tree.item.arrow()}>
            {item.isExpanded() ? (
              <Icon icon={IcRoundKeyboardArrowDown} size={18} />
            ) : (
              <Icon icon={IcRoundKeyboardArrowRight} size={18} />
            )}
          </span>
        )}
      </button>
    </div>
  )
}

export interface EntryTreeProps {
  i18nId?: string
  selected?: Array<string>
}

export function EntryTree({i18nId: entryId, selected = []}: EntryTreeProps) {
  const root = useRoot()
  const {schema} = useConfig()
  const treeProvider = useEntryTreeProvider()
  const navigate = useNavigate()
  const nav = useNav()
  const locale = useLocale()
  const tree = useTree<EntryTreeItem>({
    rootItemId: rootId(root.name),
    canDropInbetween: true,
    onDrop(items, target) {
      return treeProvider.onDrop(items, target)
    },
    asyncDataLoader: treeProvider,
    getItemName: item =>
      item.getItemData() && selectedEntry(locale, item.getItemData()).title,
    isItemFolder: item =>
      item.getItemData() && Boolean(item.getItemData().isFolder),
    onPrimaryAction: item => {
      navigate(nav.entry({entryId: item.getId()}))
    },
    initialState: {
      expandedItems: selected
    },
    state: {
      selectedItems: entryId ? [entryId] : []
    },
    features: [
      asyncDataLoaderFeature as any,
      selectionFeature,
      dragAndDropFeature
      // hotkeysCoreFeature
    ]
  })
  const changed = useAtomValue(changedEntriesAtom)
  useEffect(() => {
    ;(async () => {
      for (const id of selected) {
        await treeProvider
          .getChildren(id)
          .then(() => new Promise(requestAnimationFrame))
        tree.expandItem(id)
      }
    })()
  }, [selected.join()])
  useEffect(() => {
    tree.invalidateChildrenIds(rootId(root.name))
    for (const item of tree.getItems()) {
      const typeName: string = item.getItemData()?.type
      const type = schema[typeName]
      const {orderChildrenBy} = Type.meta(type)
      if (orderChildrenBy) tree.invalidateChildrenIds(item.getId())
    }
  }, [treeProvider])
  useEffect(() => {
    for (const i18nId of changed) {
      try {
        const item = tree.getItemInstance(i18nId)
        if (!item) {
          console.log(`Item not found: ${i18nId}`)
          tree.invalidateChildrenIds(rootId(root.name))
          continue
        }
        const parent = item.getParent()
        const parentId = parent?.getId()
        if (parentId) tree.invalidateChildrenIds(parentId)
      } catch (e) {
        console.error(e)
      } finally {
        tree.invalidateItemData(i18nId)
        tree.invalidateChildrenIds(i18nId)
      }
    }
  }, [changed])
  return (
    <>
      <div ref={tree.registerElement} className={styles.tree()}>
        {tree.getItems().map((item, i) => {
          const data = item.getItemData()
          return <EntryTreeItem key={item.getId()} item={item} data={data} />
        })}
      </div>
    </>
  )
}
