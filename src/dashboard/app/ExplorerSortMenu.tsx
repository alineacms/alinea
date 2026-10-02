import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Icon
} from '#/components.js'
import type {OverviewSort} from '#/core/Overview.js'
import type {OverviewSortState} from '#/dashboard/atoms/overview.js'
import styler from '@alinea/styler'
import {
  IcRoundArrowDownward,
  IcRoundArrowUpward,
  IcRoundCheck,
  IcRoundKeyboardArrowDown,
  IcRoundSwapVert
} from '../icons.js'
import css from './ExplorerSortMenu.module.css'

const styles = styler(css)

export interface ExplorerSortMenuProps {
  /** The orders editors can pick */
  sorts: Array<OverviewSortState>
  /** The order the editor picked, undefined for the default order */
  sort: OverviewSort | undefined
  /** The label of the picked order */
  label: string | undefined
  onSort(sort: OverviewSort | undefined): void
  size?: 'default' | 'sm'
}

/** The orders of a list, picking the current one again reverses it */
export function ExplorerSortMenu({
  sorts,
  sort,
  label,
  onSort,
  size = 'default'
}: ExplorerSortMenuProps) {
  const picked = sort && label
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        variant="outline"
        icon={IcRoundSwapVert}
        aria-label={picked ? `Sort by ${label}` : 'Sort'}
        active={Boolean(sort)}
        size={size}
        className={styles.ExplorerSortMenu.trigger()}
      >
        {picked ? label : 'Sort'}
        <Icon
          icon={IcRoundKeyboardArrowDown}
          className={styles.ExplorerSortMenu.chevron()}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent aria-label="Sort by" align="start">
        <DropdownMenuItem
          textValue="Default order"
          onSelect={() => onSort(undefined)}
        >
          Default order
          {!sort && (
            <Icon
              icon={IcRoundCheck}
              className={styles.ExplorerSortMenu.mark()}
            />
          )}
        </DropdownMenuItem>
        {sorts.map(option => {
          const current =
            sort?.column === option.key ? sort.direction : undefined
          const direction = current
            ? current === 'asc'
              ? 'desc'
              : 'asc'
            : option.direction
          return (
            <DropdownMenuItem
              key={option.key}
              textValue={option.label}
              onSelect={() => onSort({column: option.key, direction})}
            >
              {option.label}
              {current && (
                <Icon
                  aria-label={current === 'asc' ? 'Ascending' : 'Descending'}
                  icon={
                    current === 'asc'
                      ? IcRoundArrowUpward
                      : IcRoundArrowDownward
                  }
                  className={styles.ExplorerSortMenu.mark()}
                />
              )}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
