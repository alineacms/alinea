import styler from '@alinea/styler'
import type {QueryWithResult} from 'alinea/core/Graph'
import type {Schema} from 'alinea/core/Schema'
import type {SummaryProps} from 'alinea/core/media/Summary'
import {type ComponentType, memo} from 'react'
import {useQuery} from 'react-query'
import {useGraph} from '../../hook/UseGraph.js'
import type {ExporerItemSelect} from './Explorer.js'
import {ExplorerItem} from './ExplorerItem.js'
import css from './ExplorerRow.module.scss'

const styles = styler(css)

export type ExplorerRowProps = {
  schema: Schema
  query: QueryWithResult<ExporerItemSelect>
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
  const graph = useGraph()
  const start = Math.floor(from / batchSize)
  const startAt = from % batchSize
  const {data} = useQuery(
    ['explorer', 'batch', query, batchSize, start],
    async () => {
      return graph.find({
        ...query,
        skip: start * batchSize,
        take: batchSize,
        status: 'preferDraft'
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
