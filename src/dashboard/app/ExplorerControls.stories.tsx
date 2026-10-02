import {mediaOverview} from '#/core/media/MediaTypes.js'
import type {OverviewSort} from '#/core/Overview.js'
import {cms} from '#/dashboard/fixture/cms.ts?alinea'
import {useState} from 'react'
import {
  type OverviewFilterSelection,
  type OverviewFilterState,
  type OverviewState,
  resolveOverviewOptions
} from '../atoms/overview.js'
import {
  ExplorerControls,
  type ExplorerControlsProps
} from './ExplorerControls.js'

const media = resolveOverviewOptions(
  cms.config,
  mediaOverview(),
  ['MediaLibrary', 'MediaFile'],
  undefined
)

const products = resolveOverviewOptions(
  cms.config,
  undefined,
  ['Page'],
  undefined
)

interface ControlsStateProps {
  initialSort?: OverviewSort
  initialFilters?: OverviewFilterSelection
}

/** Keeps the picked order and filters like the explorer atoms do */
function useControls(
  overview: OverviewState,
  {initialSort, initialFilters = {}}: ControlsStateProps = {}
): ExplorerControlsProps {
  const [sort, setSort] = useState(initialSort)
  const [picked, setPicked] = useState(initialFilters)
  function onToggleFilter(filter: OverviewFilterState, option: string) {
    const {[filter.key]: current = [], ...others} = picked
    const next = current.includes(option)
      ? current.filter(key => key !== option)
      : filter.multiple
        ? [...current, option]
        : [option]
    setPicked(next.length > 0 ? {...others, [filter.key]: next} : others)
  }
  const option = overview.sorts.find(option => option.key === sort?.column)
  return {
    sorts: overview.sorts,
    sort,
    sortLabel: option?.label,
    filters: overview.filters,
    picked,
    onSort: setSort,
    onToggleFilter,
    onReset: () => {
      setPicked({})
      setSort(undefined)
    }
  }
}

const frame = {display: 'flex', gap: 8, padding: 16}

/** The media library declares its filters and orders */
export function MediaLibrary() {
  const controls = useControls(media)
  return (
    <div style={frame}>
      <ExplorerControls {...controls} />
    </div>
  )
}

/** Filtered to PDF and documents, listed Z–A */
export function MediaLibraryFiltered() {
  const controls = useControls(media, {
    initialSort: {column: 'title', direction: 'desc'},
    initialFilters: {fileType: ['pdf', 'document'], show: ['files']}
  })
  return (
    <div style={frame}>
      <ExplorerControls {...controls} />
    </div>
  )
}

/** An overview without declared filters or sorts: the sortable columns */
export function ColumnSorts() {
  const controls = useControls(products, {
    initialSort: {column: 'title', direction: 'desc'}
  })
  return (
    <div style={frame}>
      <ExplorerControls {...controls} />
    </div>
  )
}

export default {
  title: 'Dashboard / ExplorerControls'
}
