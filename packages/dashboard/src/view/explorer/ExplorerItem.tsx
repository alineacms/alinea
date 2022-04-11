import {Entry, Schema, View} from '@alinea/core'
import {useExplorer} from '@alinea/dashboard/hook/UseExplorer'
import {useFocusListItem} from '@alinea/dashboard/hook/UseFocusList'
import {fromModule} from '@alinea/ui'
import {MdCheckBox, MdCheckBoxOutlineBlank} from 'react-icons/md'
import {Link} from 'react-router-dom'
import {useDashboard} from '../../hook/UseDashboard'
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
  const {nav} = useDashboard()
  const explorer = useExplorer()
  const itemRef = useFocusListItem(() => explorer?.onSelect(entry))
  const View: any = schema.type(entry.type)?.options[summaryView] || defaultView
  const Tag: any = explorer?.selectable ? 'label' : Link
  const props = explorer?.selectable
    ? {}
    : {to: nav.entry(entry.workspace, entry.root, entry.id)}
  const isSelected = Boolean(
    explorer?.selection.find(v => v.type === 'entry' && v.entry === entry.id)
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
              {isSelected ? <MdCheckBox /> : <MdCheckBoxOutlineBlank />}
            </div>
          </>
        )}
        <View {...entry} />
      </div>
    </Tag>
  )
}
