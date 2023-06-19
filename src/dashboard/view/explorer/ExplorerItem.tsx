import {Entry, Schema, Type, View} from 'alinea/core'
import {link} from 'alinea/dashboard/util/HashRouter'
import {EntryReference} from 'alinea/picker/entry'
import {fromModule} from 'alinea/ui'
import {IcRoundCheckBox} from 'alinea/ui/icons/IcRoundCheckBox'
import {IcRoundCheckBoxOutlineBlank} from 'alinea/ui/icons/IcRoundCheckBoxOutlineBlank'
import {useExplorer} from '../../hook/UseExplorer.js'
import {useFocusListItem} from '../../hook/UseFocusList.js'
import {useNav} from '../../hook/UseNav.js'
import css from './ExplorerItem.module.scss'

const styles = fromModule(css)

export type ExplorerItemProps = {
  schema: Schema
  entry: Entry
  summaryView: 'summaryRow' | 'summaryThumb'
  defaultView: View<Entry, any>
}

export function ExplorerItem({
  schema,
  entry,
  summaryView,
  defaultView
}: ExplorerItemProps) {
  const nav = useNav()
  const explorer = useExplorer()
  const itemRef = useFocusListItem(() => explorer?.onSelect(entry))
  const type = schema[entry.type]
  const View: any = (type && Type.meta(type)[summaryView]) || defaultView
  const Tag: any = explorer?.selectable ? 'label' : 'a'
  const props = explorer?.selectable ? {} : link(nav.entry(entry))
  const isSelected = Boolean(
    explorer?.selection.find(
      v => EntryReference.isEntryReference(v) && v.entry === entry.entryId
    )
  )
  return (
    <Tag
      key={entry.entryId}
      className={styles.root(summaryView === 'summaryRow' ? 'row' : 'thumb', {
        selected: isSelected
      })}
      {...props}
      ref={itemRef}
    >
      <div className={styles.root.inner()}>
        {explorer?.selectable && (
          <>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => explorer?.onSelect(entry)}
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
      </div>
    </Tag>
  )
}
