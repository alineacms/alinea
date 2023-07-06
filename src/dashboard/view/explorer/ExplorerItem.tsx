import {Schema, Type, View} from 'alinea/core'
import {link} from 'alinea/dashboard/util/HashRouter'
import {EntryReference} from 'alinea/picker/entry/EntryReference'
import {HStack, Icon, fromModule} from 'alinea/ui'
import {IcOutlineInsertDriveFile} from 'alinea/ui/icons/IcOutlineInsertDriveFile'
import {IcRoundCheckBox} from 'alinea/ui/icons/IcRoundCheckBox'
import {IcRoundCheckBoxOutlineBlank} from 'alinea/ui/icons/IcRoundCheckBoxOutlineBlank'
import {IcRoundKeyboardArrowRight} from 'alinea/ui/icons/IcRoundKeyboardArrowRight'
import {useExplorer} from '../../hook/UseExplorer.js'
import {useFocusListItem} from '../../hook/UseFocusList.js'
import {useNav} from '../../hook/UseNav.js'
import {ExporerItemSelect} from './Explorer.js'
import css from './ExplorerItem.module.scss'

const styles = fromModule(css)

export interface ExplorerItemProps {
  schema: Schema
  entry: ExporerItemSelect
  summaryView: 'summaryRow' | 'summaryThumb'
  defaultView: View<ExporerItemSelect, any>
}

export function ExplorerItem({
  schema,
  entry,
  summaryView,
  defaultView
}: ExplorerItemProps) {
  const nav = useNav()
  const explorer = useExplorer()
  const itemRef = useFocusListItem<HTMLDivElement>(() =>
    explorer?.onSelect(entry)
  )
  const type = schema[entry.type]
  const View: any = (type && Type.meta(type)[summaryView]) || defaultView
  const Tag: any = explorer?.selectable ? 'label' : 'a'
  const props = explorer?.selectable ? {} : link(nav.entry(entry))
  const isSelected = Boolean(
    explorer?.selection.find(
      v => EntryReference.isEntryReference(v) && v.entry === entry.entryId
    )
  )
  const childrenAmount = entry.childrenAmount ?? 0
  return (
    <div
      ref={itemRef}
      key={entry.entryId}
      className={styles.root(summaryView === 'summaryRow' ? 'row' : 'thumb', {
        selected: isSelected
      })}
      tabIndex={0}
    >
      <div className={styles.root.inner()}>
        <HStack
          as={Tag}
          className={styles.root.inner.hitBox()}
          style={{flexGrow: 1}}
          {...props}
        >
          {explorer?.selectable && (
            <>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => {
                  explorer.onSelect(entry)
                }}
                className={styles.root.checkbox()}
              />
              <div className={styles.root.selection()}>
                {isSelected ? (
                  <IcRoundCheckBox />
                ) : (
                  <IcRoundCheckBoxOutlineBlank />
                )}
              </div>
            </>
          )}

          <View {...entry} />
        </HStack>

        {explorer.onNavigate && childrenAmount > 0 && (
          <button
            type="button"
            className={styles.root.children()}
            onClick={() => {
              explorer.onNavigate?.(entry.entryId)
            }}
          >
            <Icon icon={IcOutlineInsertDriveFile} size={18} />

            <span className={styles.root.children.badge()}>
              {childrenAmount}
            </span>

            <Icon icon={IcRoundKeyboardArrowRight} size={18} />
          </button>
        )}
      </div>
    </div>
  )
}
