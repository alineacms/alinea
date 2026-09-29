import {Surface} from '#/components.js'
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
  ExplorerControlsMenu,
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
  return {
    sorts: overview.sorts,
    sort,
    filters: overview.filters,
    picked,
    onSort: setSort,
    onToggleFilter,
    onClearFilters: () => setPicked({})
  }
}

const surfaceStyle = {padding: 8, width: 'fit-content', margin: 16}

/** The popover of the media library, with its declared sorts and filters */
export function MediaLibrary() {
  const controls = useControls(media)
  return (
    <Surface style={surfaceStyle}>
      <ExplorerControlsMenu {...controls} />
    </Surface>
  )
}

/** Filtered to PDF and documents, listed Z–A */
export function MediaLibraryFiltered() {
  const controls = useControls(media, {
    initialSort: {column: 'title', direction: 'desc'},
    initialFilters: {fileType: ['pdf', 'document'], show: ['files']}
  })
  return (
    <Surface style={surfaceStyle}>
      <ExplorerControlsMenu {...controls} />
    </Surface>
  )
}

/** An overview without declared sorts: the title and sortable columns */
export function ColumnSorts() {
  const controls = useControls(products, {
    initialSort: {column: 'title', direction: 'desc'}
  })
  return (
    <Surface style={surfaceStyle}>
      <ExplorerControlsMenu {...controls} />
    </Surface>
  )
}

/** The toolbar button that opens the popover */
export function Button() {
  const controls = useControls(media, {initialFilters: {fileType: ['pdf']}})
  return (
    <div style={{display: 'flex', justifyContent: 'flex-end', padding: 16}}>
      <ExplorerControls {...controls} />
    </div>
  )
}

export default {
  title: 'Dashboard / ExplorerControls'
}
