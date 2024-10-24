import styler from '@alinea/styler'
import useSize from '@react-hook/size'
import {QueryWithResult} from 'alinea/core/Graph'
import {Reference} from 'alinea/core/Reference'
import {summarySelection} from 'alinea/core/media/Summary'
import {Loader} from 'alinea/ui'
import {useAtomValue} from 'jotai'
import {useEffect, useRef} from 'react'
import {useQuery, useQueryClient} from 'react-query'
import VirtualList from 'react-tiny-virtual-list'
import {changedEntriesAtom, graphAtom} from '../../atoms/DbAtoms.js'
import {useConfig} from '../../hook/UseConfig.js'
import {ExplorerProvider} from '../../hook/UseExplorer.js'
import {EntrySummaryRow, EntrySummaryThumb} from '../entry/EntrySummary.js'
import css from './Explorer.module.scss'
import {ExplorerRow} from './ExplorerRow.js'

const styles = styler(css)

const defaultSummaryView = {
  summaryRow: EntrySummaryRow,
  summaryThumb: EntrySummaryThumb
}

export interface ExporerItemSelect {
  id: string
  type: string
  workspace: string
  root: string
  title: string
  i18nId?: string
  childrenAmount?: number
}

export interface ExplorerProps {
  query: QueryWithResult<ExporerItemSelect>
  type: 'row' | 'thumb'
  virtualized?: boolean
  max?: number
  selectable?: Array<string> | boolean
  selection?: Array<Reference>
  toggleSelect?: (entry: ExporerItemSelect) => void
  onNavigate?: (entryId: string) => void
  showMedia?: boolean
  withNavigation?: boolean
  border?: boolean
}

export function Explorer({
  type,
  query,
  virtualized,
  max,
  selectable,
  selection = [],
  toggleSelect = () => {},
  onNavigate,
  withNavigation,
  showMedia,
  border = true
}: ExplorerProps) {
  const {schema} = useConfig()
  const graph = useAtomValue(graphAtom)

  const queryClient = useQueryClient()
  const changed = useAtomValue(changedEntriesAtom)
  useEffect(() => {
    if (changed.length > 0) queryClient.invalidateQueries('explorer')
  }, [changed])

  const {data, isLoading} = useQuery(
    ['explorer', type, query, max],
    async () => {
      const summaryView = type === 'row' ? 'summaryRow' : 'summaryThumb'
      const defaultView = defaultSummaryView[summaryView]
      const selection = summarySelection(schema)
      const total = await graph.count({
        ...query,
        status: 'preferDraft'
      })
      const querySelection: QueryWithResult<ExporerItemSelect> = {
        ...query,
        select: selection as any
      }
      return {
        type,
        total: max ? Math.min(max, total) : total,
        selection,
        query: querySelection,
        summaryView,
        defaultView
      } as const
    },
    {keepPreviousData: true}
  )
  const containerRef = useRef(null)
  const [containerWidth, containerHeight] = useSize(containerRef)
  const perRow = data?.type === 'thumb' ? Math.round(containerWidth / 260) : 1
  const height = data?.type === 'thumb' ? 180 : 50
  const batchSize = data?.type === 'thumb' ? perRow * 10 : 50
  const showList =
    data && containerWidth > 0 && (!virtualized || containerHeight > 0)
  return (
    <ExplorerProvider
      value={{
        selectable,
        selection,
        onSelect: toggleSelect,
        onNavigate,
        withNavigation,
        showMedia,
        border
      }}
    >
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
                        query={data.query}
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
                        query={data.query}
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
