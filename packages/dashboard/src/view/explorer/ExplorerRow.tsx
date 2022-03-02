import {Entry, Outcome, Schema, View} from '@alinea/core'
import {useExplorer} from '@alinea/dashboard/hook/UseExplorer'
import {useFocusListItem} from '@alinea/dashboard/hook/UseFocusList'
import {Cursor} from '@alinea/store'
import {fromModule} from '@alinea/ui'
import {memo} from 'react'
import {MdCheckBox, MdCheckBoxOutlineBlank} from 'react-icons/md'
import {useQuery} from 'react-query'
import {Link} from 'react-router-dom'
import {useDashboard} from '../../hook/UseDashboard'
import {useSession} from '../../hook/UseSession'
import css from './ExplorerRow.module.scss'

const styles = fromModule(css)

type ExplorerRowItemProps = {
  schema: Schema
  entry: Entry.Minimal
  summaryView: 'summaryRow' | 'summaryThumb'
  defaultView: View<Entry, any>
}

function ExplorerRowItem({
  schema,
  entry,
  summaryView,
  defaultView
}: ExplorerRowItemProps) {
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
      className={styles.item(summaryView === 'summaryRow' ? 'row' : 'thumb', {
        selected: isSelected
      })}
      {...props}
      ref={itemRef}
    >
      <div className={styles.item.inner()}>
        {explorer?.selectable && (
          <>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => explorer?.onSelect(entry)}
              className={styles.item.checkbox()}
            />
            <div className={styles.item.selection()}>
              {isSelected ? <MdCheckBox /> : <MdCheckBoxOutlineBlank />}
            </div>
          </>
        )}
        <View {...entry} />
      </div>
    </Tag>
  )
}

export type ExplorerRowProps = {
  schema: Schema
  cursor: Cursor<Entry.Minimal>
  batchSize: number
  amount: number
  from: number
  summaryView: 'summaryRow' | 'summaryThumb'
  defaultView: View<Entry, any>
}

export const ExplorerRow = memo(function ExplorerRow({
  schema,
  cursor,
  batchSize,
  amount,
  from,
  summaryView,
  defaultView
}: ExplorerRowProps) {
  const {hub} = useSession()
  const start = Math.floor(from / batchSize)
  const startAt = from % batchSize
  const {data} = useQuery(
    ['explorer', 'batch', cursor, batchSize, start],
    () => {
      return hub
        .query(cursor.skip(start * batchSize).take(batchSize))
        .then(Outcome.unpack)
    },
    {refetchOnWindowFocus: false, keepPreviousData: true, staleTime: 10000}
  )
  const entries = data?.slice(startAt, startAt + amount)
  return (
    <div className={styles.root()}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${amount}, 1fr)`,
          height: '100%'
        }}
      >
        {entries?.map(entry => {
          return (
            <ExplorerRowItem
              key={entry.id}
              schema={schema}
              entry={entry}
              summaryView={summaryView}
              defaultView={defaultView}
            />
          )
        })}
      </div>
    </div>
  )
})
