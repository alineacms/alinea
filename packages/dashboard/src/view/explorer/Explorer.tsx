import {Entry, Outcome, Schema} from '@alinea/core'
import {Cursor, Functions, SelectionInput} from '@alinea/store'
import {fromModule} from '@alinea/ui'
import useSize from '@react-hook/size'
import {useRef} from 'react'
import {useQuery} from 'react-query'
import VirtualList from 'react-tiny-virtual-list'
import {useSession} from '../../hook/UseSession'
import {EntrySummaryRow, EntrySummaryThumb} from '../entry/EntrySummary'
import css from './Explorer.module.scss'
import {ExplorerRow} from './ExplorerRow'

const styles = fromModule(css)

const defaultSummaryView = {
  summaryRow: EntrySummaryRow,
  summaryThumb: EntrySummaryThumb
}

function getSelection(
  schema: Schema,
  summaryView: 'summaryRow' | 'summaryThumb'
) {
  const cases: Record<string, SelectionInput> = {}
  for (const [name, type] of schema) {
    const view = type.options[summaryView]
    if (view) cases[name] = view.selection(Entry)
  }
  return cases
}

export type ExplorerProps = {
  schema: Schema
  cursor: Cursor<Entry>
  type: 'row' | 'thumb'
}

export function Explorer({schema, type, cursor}: ExplorerProps) {
  const {hub} = useSession()
  const {data} = useQuery(
    ['explorer', type, cursor, schema],
    () => {
      const summaryView = type === 'row' ? 'summaryRow' : 'summaryThumb'
      const selection = getSelection(schema, summaryView)
      const result = hub.query(cursor.select(Functions.count()))
      return Object.assign(
        result.then(Outcome.unpack).then(([total]) => {
          const defaultView = defaultSummaryView[summaryView]
          return {
            type,
            total,
            selection,
            cursor: cursor.select(
              Entry.type.case(selection, defaultView.selection(Entry))
            ),
            summaryView,
            defaultView
          } as const
        }),
        {cancel: (result as any).cancel}
      )
    },
    {keepPreviousData: true}
  )
  const containerRef = useRef(null)
  const [containerWidth, containerHeight] = useSize(containerRef)
  const perRow = data?.type === 'thumb' ? Math.round(containerWidth / 240) : 1
  const height = data?.type === 'thumb' ? 200 : 44
  const batchSize = data?.type === 'thumb' ? perRow * 10 : 30
  return (
    <div ref={containerRef} className={styles.root()}>
      {containerHeight > 0 && data && (
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
              <div key={index} style={{...style, height}}>
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
      )}
    </div>
  )
}
