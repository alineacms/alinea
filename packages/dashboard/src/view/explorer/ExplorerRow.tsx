import {Entry, Outcome, Schema, View} from '@alinea/core'
import {Cursor} from '@alinea/store'
import {fromModule} from '@alinea/ui'
import {memo} from 'react'
import {useQuery} from 'react-query'
import {useSession} from '../../hook/UseSession'
import css from './ExplorerRow.module.scss'

const styles = fromModule(css)

export type MediaRowProps = {
  schema: Schema
  cursor: Cursor<{id: string; type: string}>
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
}: MediaRowProps) {
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
          const View: any =
            schema.type(entry.type)?.options[summaryView] || defaultView
          return <View key={entry.id} {...entry} />
        })}
      </div>
    </div>
  )
})
