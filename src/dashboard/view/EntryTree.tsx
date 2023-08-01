import {EntryPhase, Type} from 'alinea/core'
import {Icon, fromModule, px} from 'alinea/ui'
import {IcOutlineInsertDriveFile} from 'alinea/ui/icons/IcOutlineInsertDriveFile'
import {IcRoundEdit} from 'alinea/ui/icons/IcRoundEdit'
import {IcRoundKeyboardArrowDown} from 'alinea/ui/icons/IcRoundKeyboardArrowDown'
import {IcRoundKeyboardArrowRight} from 'alinea/ui/icons/IcRoundKeyboardArrowRight'
import {IcRoundTranslate} from 'alinea/ui/icons/IcRoundTranslate'
import {Tree, TreeItem, UncontrolledTreeEnvironment} from 'react-complex-tree'
import {
  ENTRY_TREE_ROOT_KEY,
  EntryTreeItem,
  useEntryTreeProvider
} from '../atoms/EntryAtoms.js'
import {useConfig} from '../hook/UseConfig.js'
import {useLocale} from '../hook/UseLocale.js'
import {useNav} from '../hook/UseNav.js'
import {useNavigate} from '../util/HashRouter.js'
import css from './EntryTree.module.scss'
import './EntryTree.scss'

const styles = fromModule(css)

export interface EntryTreeProps {
  entryId?: string
  selected?: Array<string>
}

// Todo: convert to controlled & virtualize (lukasbach/react-complex-tree#263)

export function EntryTree({entryId, selected = []}: EntryTreeProps) {
  const {schema} = useConfig()
  const dataProvider = useEntryTreeProvider()
  const navigate = useNavigate()
  const nav = useNav()
  const locale = useLocale()
  function selectedEntry(item: TreeItem<EntryTreeItem>) {
    return (
      item.data.entries.find(entry => entry.locale === locale) ??
      item.data.entries[0]
    )
  }
  return (
    <div className="rct-dark" style={{flexGrow: 1, overflow: 'auto'}}>
      <UncontrolledTreeEnvironment<EntryTreeItem>
        dataProvider={dataProvider}
        getItemTitle={item => {
          return selectedEntry(item).title
        }}
        canDragAndDrop={true}
        canDropOnFolder={true}
        canReorderItems={true}
        renderItemArrow={({context, item, info}) => {
          const hasChildren = Boolean(item.children?.length)
          if (!hasChildren) return null
          const {isExpanded} = context
          return (
            <span className="rct-tree-item-arrow">
              {isExpanded ? (
                <IcRoundKeyboardArrowDown style={{fontSize: px(20)}} />
              ) : (
                <IcRoundKeyboardArrowRight style={{fontSize: px(20)}} />
              )}
            </span>
          )
        }}
        renderItemTitle={({title, item}) => {
          const selected = selectedEntry(item)
          const hasChildren = Boolean(item.children?.length)
          const {icon} = Type.meta(schema[selected.type])
          const isDraft = selected.phase === EntryPhase.Draft
          const isUntranslated = locale && selected.locale !== locale
          return (
            <>
              {!hasChildren && (
                <span className="rct-tree-item-icon">
                  <Icon icon={icon || IcOutlineInsertDriveFile} />
                </span>
              )}

              <span className={styles.title({untranslated: isUntranslated})}>
                {title}
              </span>

              {isUntranslated && (
                <span className={styles.status()}>
                  <IcRoundTranslate />
                </span>
              )}

              {!isUntranslated && isDraft && (
                <span className={styles.status()}>
                  <IcRoundEdit />
                </span>
              )}
            </>
          )
        }}
        onPrimaryAction={item => {
          navigate(nav.entry({entryId: item.index as string}))
        }}
        onExpandItem={item => {
          navigate(nav.entry({entryId: item.index as string}))
        }}
        onCollapseItem={item => {
          navigate(nav.entry({entryId: item.index as string}))
        }}
        viewState={{
          ['entry-tree']: {
            selectedItems: entryId ? [entryId] : [],
            expandedItems: selected
          }
        }}
      >
        <Tree treeId="entry-tree" rootItem={ENTRY_TREE_ROOT_KEY} />
      </UncontrolledTreeEnvironment>
    </div>
  )
}
