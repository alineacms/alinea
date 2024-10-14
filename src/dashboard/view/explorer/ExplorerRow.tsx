import styler from '@alinea/styler'
import {GraphQuery} from 'alinea/core/Graph'
import {Schema} from 'alinea/core/Schema'
import {SummaryProps} from 'alinea/core/media/Summary'
import {useAtomValue} from 'jotai'
import {ComponentType, memo} from 'react'
import {useQuery} from 'react-query'
import {graphAtom} from '../../atoms/DbAtoms.js'
import {ExporerItemSelect} from './Explorer.js'
import {ExplorerItem} from './ExplorerItem.js'
import css from './ExplorerRow.module.scss'

const styles = styler(css)

export type ExplorerRowProps = {
  schema: Schema
  query: GraphQuery<ExporerItemSelect>
  batchSize: number
  amount: number
  from: number
  summaryView: 'summaryRow' | 'summaryThumb'
  defaultView: ComponentType<SummaryProps>
}

export const ExplorerRow = memo(function ExplorerRow({
  schema,
  query,
  batchSize,
  amount,
  from,
  summaryView,
  defaultView
}: ExplorerRowProps) {
  const {preferDraft: active} = useAtomValue(graphAtom)
  const start = Math.floor(from / batchSize)
  const startAt = from % batchSize
  const {data} = useQuery(
    ['explorer', 'batch', query, batchSize, start],
    async () => {
      return active.query({
        ...query,
        skip: start * batchSize,
        take: batchSize
      })
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
