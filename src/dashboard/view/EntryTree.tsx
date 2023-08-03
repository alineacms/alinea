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
}

function EntryTreeItem({item}: EntryTreeItemProps) {
  const locale = useLocale()
  const {schema} = useConfig()
  const currentData = useRef<EntryTreeItem>()
  const data: EntryTreeItem = item.getItemData() ?? currentData.current
  if (!data) return console.log(item), null
  currentData.current = data
  const selected = selectedEntry(locale, data)
  const {icon} = Type.meta(schema[selected.type])
  const isDraft = selected.phase === EntryPhase.Draft
  const isUntranslated = locale && selected.locale !== locale
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
          {selectedEntry(locale, data).title}
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
  const dataLoader = useEntryTreeProvider()
  const navigate = useNavigate()
  const nav = useNav()
  const locale = useLocale()
  const tree = useTree<EntryTreeItem>({
    rootItemId: rootId(root.name),
    canDropInbetween: true,
    onDrop: (items, target) => {
      console.log(
        `Dropped ${items.map(item =>
          item.getId()
        )} on ${target.item.getId()}, index ${target.childIndex}`
      )
    },
    asyncDataLoader: dataLoader,
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
  }, [dataLoader])
  useEffect(() => {
    for (const id of changed) {
      tree.invalidateItemData(id)
    }
  }, [changed])
  return (
    <>
      <div ref={tree.registerElement} className={styles.tree()}>
        {tree.getItems().map(item => {
          return <EntryTreeItem key={item.getId()} item={item} />
        })}
      </div>
    </>
  )
}
