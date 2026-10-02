import {Button} from '#/components.js'
import type {OverviewSort} from '#/core/Overview.js'
import type {
  OverviewFilterSelection,
  OverviewFilterState,
  OverviewSortState
} from '#/dashboard/atoms/overview.js'
import {ExplorerFilterMenu} from './ExplorerFilterMenu.js'
import {ExplorerSortMenu} from './ExplorerSortMenu.js'

export interface ExplorerControlsProps {
  /** The orders editors can pick, none while searching */
  sorts: Array<OverviewSortState>
  /** The order the editor picked, undefined for the default order */
  sort: OverviewSort | undefined
  /** The label of the picked order */
  sortLabel: string | undefined
  /** The filters editors can apply */
  filters: Array<OverviewFilterState>
  /** The options of the filters the list is filtered by */
  picked: OverviewFilterSelection
  onSort(sort: OverviewSort | undefined): void
  onToggleFilter(filter: OverviewFilterState, option: string): void
  /** Clear the filters and return to the default order */
  onReset(): void
  /** `sm` fits the controls in a search bar */
  size?: 'default' | 'sm'
}

/** The filters and the order of a list of entries, as outline buttons */
export function ExplorerControls({
  sorts,
  sort,
  sortLabel,
  filters,
  picked,
  onSort,
  onToggleFilter,
  onReset,
  size = 'default'
}: ExplorerControlsProps) {
  const filtered = Object.keys(picked).length > 0
  return (
    <>
      {filters.length > 0 && (
        <ExplorerFilterMenu
          filters={filters}
          picked={picked}
          size={size}
          onToggle={onToggleFilter}
        />
      )}
      {sorts.length > 0 && (
        <ExplorerSortMenu
          sorts={sorts}
          sort={sort}
          label={sortLabel}
          size={size}
          onSort={onSort}
        />
      )}
      {(filtered || sort) && (
        <Button variant="ghost" size={size} onClick={onReset}>
          Reset
        </Button>
      )}
    </>
  )
}
