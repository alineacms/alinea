import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Text,
  Toggle
} from '#/components.js'
import type {OverviewSort} from '#/core/Overview.js'
import styler from '@alinea/styler'
import type {
  OverviewFilterSelection,
  OverviewFilterState,
  OverviewSortState
} from '../atoms/overview.js'
import {
  IcRoundArrowDownward,
  IcRoundArrowUpward,
  IcRoundFilterList
} from '../icons.js'
import css from './ExplorerControls.module.css'

const styles = styler(css)

export interface ExplorerControlsProps {
  /** The orders editors can pick, none while searching */
  sorts: Array<OverviewSortState>
  /** The order the editor picked, undefined for the default order */
  sort: OverviewSort | undefined
  /** The filters editors can apply */
  filters: Array<OverviewFilterState>
  /** The options of the filters the list is filtered by */
  picked: OverviewFilterSelection
  onSort(sort: OverviewSort | undefined): void
  onToggleFilter(filter: OverviewFilterState, option: string): void
  onClearFilters(): void
}

/** The "Filter and sort" button of the explorer toolbar */
export function ExplorerControls(props: ExplorerControlsProps) {
  const filtered = Object.keys(props.picked).length > 0
  return (
    <Popover>
      <PopoverTrigger
        aria-label="Filter and sort"
        variant="outline"
        active={filtered || Boolean(props.sort)}
        icon={IcRoundFilterList}
        size="icon-lg"
      />
      <PopoverContent aria-label="Filter and sort" side="bottom" align="end">
        <ExplorerControlsMenu {...props} />
      </PopoverContent>
    </Popover>
  )
}

/** The filters and orders of the "Filter and sort" popover */
export function ExplorerControlsMenu({
  sorts,
  sort,
  filters,
  picked,
  onSort,
  onToggleFilter,
  onClearFilters
}: ExplorerControlsProps) {
  const filtered = Object.keys(picked).length > 0
  return (
    <div className={styles.ExplorerControls()}>
      {filters.map(filter => (
        <div
          key={filter.key}
          role="group"
          aria-label={filter.label}
          className={styles.ExplorerControls.section()}
        >
          <Text
            as="p"
            size="sm"
            color="muted"
            className={styles.ExplorerControls.label()}
          >
            {filter.label}
          </Text>
          <div className={styles.ExplorerControls.filterOptions()}>
            {filter.options.map(option => (
              <Toggle
                key={option.key}
                size="sm"
                variant="outline"
                pressed={Boolean(picked[filter.key]?.includes(option.key))}
                onPressedChange={() => onToggleFilter(filter, option.key)}
              >
                {option.label}
              </Toggle>
            ))}
          </div>
        </div>
      ))}
      {filtered && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className={styles.ExplorerControls.clear()}
        >
          Clear filters
        </Button>
      )}
      <div
        role="group"
        aria-label="Sort by"
        className={styles.ExplorerControls.section()}
      >
        <Text
          as="p"
          size="sm"
          color="muted"
          className={styles.ExplorerControls.label()}
        >
          Sort by
        </Text>
        <Button
          variant="ghost"
          active={!sort}
          onClick={() => onSort(undefined)}
          className={styles.ExplorerControls.sortOption()}
        >
          Default order
        </Button>
        {sorts.map(option => (
          <ExplorerSortOption
            key={option.key}
            option={option}
            sort={sort}
            onSort={onSort}
          />
        ))}
      </div>
    </div>
  )
}

interface ExplorerSortOptionProps {
  option: OverviewSortState
  sort: OverviewSort | undefined
  onSort(sort: OverviewSort): void
}

/** An order in the menu, picking it again reverses its direction */
function ExplorerSortOption({option, sort, onSort}: ExplorerSortOptionProps) {
  const current = sort?.column === option.key ? sort.direction : undefined
  const direction = current
    ? current === 'asc'
      ? 'desc'
      : 'asc'
    : option.direction
  return (
    <Button
      variant="ghost"
      active={Boolean(current)}
      onClick={() => onSort({column: option.key, direction})}
      className={styles.ExplorerControls.sortOption()}
    >
      {option.label}
      {current === 'asc' && <IcRoundArrowUpward />}
      {current === 'desc' && <IcRoundArrowDownward />}
    </Button>
  )
}
