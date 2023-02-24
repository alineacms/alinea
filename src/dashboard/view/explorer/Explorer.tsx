import useSize from '@react-hook/size'
import {Entry, Outcome, Reference, Schema, View} from 'alinea/core'
import {Cursor, CursorImpl, Functions} from 'alinea/store'
import {Loader, fromModule} from 'alinea/ui'
import {useRef} from 'react'
import {useQuery} from 'react-query'
import VirtualList from 'react-tiny-virtual-list'
import {ExplorerProvider} from '../../hook/UseExplorer'
import {useSession} from '../../hook/UseSession'
import {EntrySummaryRow, EntrySummaryThumb} from '../entry/EntrySummary.js'
import css from './Explorer.module.scss'
import {ExplorerRow} from './ExplorerRow.js'

const styles = fromModule(css)

const defaultSummaryView = {
  summaryRow: EntrySummaryRow,
  summaryThumb: EntrySummaryThumb
}

export type ExplorerProps = {
  schema: Schema
  cursor: CursorImpl<Entry>
  type: 'row' | 'thumb'
  virtualized?: boolean
  max?: number
  selectable?: boolean
  selection?: Array<Reference>
  toggleSelect?: (id: Entry.Minimal) => void
}

export function Explorer({
  schema,
  type,
  cursor,
  virtualized,
  max,
  selectable = false,
  selection = [],
  toggleSelect = () => {}
}: ExplorerProps) {
  const {hub} = useSession()
  const {data, isLoading} = useQuery(
    ['explorer', type, cursor, max],
    () => {
      const summaryView = type === 'row' ? 'summaryRow' : 'summaryThumb'
      const selection = View.getSelection(schema, summaryView, Entry)
      return hub
        .query({cursor: cursor.select(Functions.count())})
        .then(Outcome.unpack)
        .then(([total]) => {
          const defaultView = defaultSummaryView[summaryView]
          return {
            type,
            total: max ? Math.min(max, total) : total,
            selection,
            cursor: cursor.select(
              Entry.type.case(selection, defaultView.selection(Entry))
            ) as Cursor<Entry.Minimal>,
            summaryView,
            defaultView
          } as const
        })
    },
    {keepPreviousData: true}
  )
  const containerRef = useRef(null)
  const [containerWidth, containerHeight] = useSize(containerRef)
  const perRow = data?.type === 'thumb' ? Math.round(containerWidth / 240) : 1
  const height = data?.type === 'thumb' ? 200 : 50
  const batchSize = data?.type === 'thumb' ? perRow * 10 : 50
  const showList =
    data && containerWidth > 0 && (!virtualized || containerHeight > 0)
  return (
    <ExplorerProvider value={{selectable, selection, onSelect: toggleSelect}}>
      <div ref={containerRef} className={styles.root()}>
        {showList ? (
          data.total > 0 ? (
            virtualized ? (
              <VirtualList
                className={styles.root.list()}
                width="100%"
                height={containerHeight}
                overscanCount={2}
                itemCount={Math.ceil(data.total / perRow)}
                itemSize={height}
                renderItem={({index, style}) => {
                  const from = index * perRow
                  return (
                    <div key={index} style={{...style, height, flexShrink: 0}}>
                      <ExplorerRow
                        schema={schema}
                        cursor={data.cursor}
                        amount={perRow}
                        from={from}
                        batchSize={batchSize}
                        summaryView={data.summaryView}
                        defaultView={data.defaultView}
                      />
                    </div>
                  )
                }}
                scrollToIndex={data.total > 0 ? 0 : undefined}
              />
            ) : (
              Array.from({length: Math.ceil(data.total / perRow)}).map(
                (_, index) => {
                  const from = index * perRow
                  return (
                    <div key={index} style={{height, flexShrink: 0}}>
                      <ExplorerRow
                        schema={schema}
                        cursor={data.cursor}
                        amount={perRow}
                        from={from}
                        batchSize={batchSize}
                        summaryView={data.summaryView}
                        defaultView={data.defaultView}
                      />
                    </div>
                  )
                }
              )
            )
          ) : (
            <div style={{margin: 'auto'}}>No results</div>
          )
        ) : (
          <Loader absolute />
        )}
      </div>
    </ExplorerProvider>
  )
}
