import {Entry, Schema, View} from 'alinea/core'
import {EntryReference} from 'alinea/picker/entry'
import {fromModule} from 'alinea/ui'
import {IcRoundCheckBox} from 'alinea/ui/icons/IcRoundCheckBox'
import {IcRoundCheckBoxOutlineBlank} from 'alinea/ui/icons/IcRoundCheckBoxOutlineBlank'
import {link} from 'alinea/ui/util/HashRouter'
import {useExplorer} from '../../hook/UseExplorer'
import {useFocusListItem} from '../../hook/UseFocusList'
import {useNav} from '../../hook/UseNav'
import css from './ExplorerItem.module.scss'

const styles = fromModule(css)

export type ExplorerItemProps = {
  schema: Schema
  entry: Entry.Minimal
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
  const View: any = schema.type(entry.type)?.options[summaryView] || defaultView
  const Tag: any = explorer?.selectable ? 'label' : 'a'
  const props = explorer?.selectable ? {} : link(nav.entry(entry))
  const isSelected = Boolean(
    explorer?.selection.find(
      v => EntryReference.isEntry(v) && v.entry === entry.id
    )
  )
  return (
    <Tag
      key={entry.id}
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
