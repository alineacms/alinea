import useSize from '@react-hook/size'
import {Entry, Reference, Schema, View} from 'alinea/core'
import {Cursor} from 'alinea/core/pages/Cursor'
import {Loader, fromModule} from 'alinea/ui'
import {useAtomValue} from 'jotai'
import {useRef} from 'react'
import {useQuery} from 'react-query'
import VirtualList from 'react-tiny-virtual-list'
import {findAtom} from '../../atoms/EntryAtoms.js'
import {ExplorerProvider} from '../../hook/UseExplorer'
import {EntrySummaryRow, EntrySummaryThumb} from '../entry/EntrySummary.js'
import css from './Explorer.module.scss'
import {ExplorerRow} from './ExplorerRow.js'

const styles = fromModule(css)

const defaultSummaryView = {
  summaryRow: EntrySummaryRow,
  summaryThumb: EntrySummaryThumb
}

export interface ExplorerProps {
  schema: Schema
  cursor: Cursor.Find<Entry>
  type: 'row' | 'thumb'
  virtualized?: boolean
  max?: number
  selectable?: boolean
  selection?: Array<Reference>
  toggleSelect?: (entry: Entry) => void
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
  //const {cnx: hub} = useSession()
  const find = useAtomValue(findAtom)
  const {data, isLoading} = useQuery(
    ['explorer', type, cursor, max],
    () => {
      const summaryView = type === 'row' ? 'summaryRow' : 'summaryThumb'
      const defaultView = defaultSummaryView[summaryView]
      const selection = View.getSelection(schema, summaryView)
      let total = 1000
      return {
        type,
        total: max ? Math.min(max, total) : total,
        selection,
        cursor: cursor.select(selection),
        summaryView,
        defaultView
      } as const
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
