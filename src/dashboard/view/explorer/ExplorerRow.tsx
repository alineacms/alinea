import {Entry, Schema, View} from 'alinea/core'
import {Cursor} from 'alinea/core/pages/Cursor'
import {fromModule} from 'alinea/ui'
import {useAtomValue} from 'jotai'
import {memo} from 'react'
import {useQuery} from 'react-query'
import {graphAtom} from '../../atoms/EntryAtoms.js'
import {ExplorerItem} from './ExplorerItem.js'
import css from './ExplorerRow.module.scss'

const styles = fromModule(css)

export type ExplorerRowProps = {
  schema: Schema
  cursor: Cursor.Find<Entry>
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
  const {active} = useAtomValue(graphAtom)
  const start = Math.floor(from / batchSize)
  const startAt = from % batchSize
  const {data} = useQuery(
    ['explorer', 'batch', cursor, batchSize, start],
    async () => {
      return active.find(cursor.skip(start * batchSize).take(batchSize))
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
          if (!entry) return null
          return (
            <ExplorerItem
              key={entry.entryId}
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
