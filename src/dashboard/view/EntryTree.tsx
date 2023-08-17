import {
  ItemInstance,
  asyncDataLoaderFeature,
  dragAndDropFeature,
  selectionFeature
} from '@headless-tree/core'
import {useTree} from '@headless-tree/react'
import {EntryPhase, Type} from 'alinea/core'
import {Icon, fromModule, px} from 'alinea/ui'
import {IcOutlineInsertDriveFile} from 'alinea/ui/icons/IcOutlineInsertDriveFile'
import IcRoundArchive from 'alinea/ui/icons/IcRoundArchive'
import {IcRoundEdit} from 'alinea/ui/icons/IcRoundEdit'
import {IcRoundKeyboardArrowDown} from 'alinea/ui/icons/IcRoundKeyboardArrowDown'
import {IcRoundKeyboardArrowRight} from 'alinea/ui/icons/IcRoundKeyboardArrowRight'
import {IcRoundTranslate} from 'alinea/ui/icons/IcRoundTranslate'
import {useAtomValue} from 'jotai'
import {useEffect, useRef} from 'react'
import {changedEntriesAtom} from '../atoms/DbAtoms.js'
import {
  EntryTreeItem,
  rootId,
  useEntryTreeProvider
} from '../atoms/EntryAtoms.js'
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
  return (
    <div
      {...item.getProps()}
      ref={item.registerElement}
      className={styles.tree.item({
        untranslated: isUntranslated,
        selected: /*entryId &&*/ item.isSelected(),
        drop: item.isDropTarget() && item.isDraggingOver(),
        dropAbove: item.isDropTargetAbove() && item.isDraggingOver(),
        dropBelow: item.isDropTargetBelow() && item.isDraggingOver()
      })}
      key={item.getId()}
      data-id={item.getId()}
    >
      <button
        className={styles.tree.item.label()}
        style={{paddingLeft: px((item.getItemMeta().level + 1) * 12)}}
      >
        {item.isFolder() && (
          <span className={styles.tree.item.arrow()}>
            {item.isExpanded() ? (
              <Icon icon={IcRoundKeyboardArrowDown} size={20} />
            ) : (
              <Icon icon={IcRoundKeyboardArrowRight} size={20} />
            )}
          </span>
        )}

        {!item.isFolder() && (
          <span className={styles.tree.item.icon()}>
            <Icon
              icon={
                isUntranslated
                  ? IcRoundTranslate
                  : icon || IcOutlineInsertDriveFile
              }
            />
          </span>
        )}

        <span className={styles.tree.item.label.itemName()}>
          {selectedEntry(locale, itemData).title}
        </span>

        {/*isUntranslated && (
            <span className={styles.tree.status()}>
              <Icon icon={IcRoundTranslate} />
            </span>
          )*/}

        {!isUntranslated && isDraft && (
          <span className={styles.tree.status({draft: true})}>
            <Icon icon={IcRoundEdit} />
          </span>
        )}

        {!isUntranslated && isArchived && (
          <span className={styles.tree.status({archived: true})}>
            <Icon icon={IcRoundArchive} size={18} />
          </span>
        )}

        {/*item.isLoading() && <Loader />*/}
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
    tree.invalidateChildrenIds(rootId(root.name))
  }, [treeProvider])
  useEffect(() => {
    console.log('changed', changed)
    for (const id of changed) {
      try {
        const item = tree.getItemInstance(id)
        if (!item) {
          tree.invalidateChildrenIds(rootId(root.name))
          continue
        }
        const parent = item.getParent()
        const parentId = parent?.getId()
        if (parentId) tree.invalidateChildrenIds(parentId)

        tree.invalidateChildrenIds(id)
        tree.invalidateItemData(id)
      } catch (e) {}
    }
  }, [changed])
  return (
    <>
      <div ref={tree.registerElement} className={styles.tree()}>
        {tree.getItems().map((item, i) => {
          return <EntryTreeItem key={i} item={item} data={item.getItemData()} />
        })}
      </div>
    </>
  )
}
