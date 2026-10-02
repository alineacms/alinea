import {
  Icon,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Toggle
} from '#/components.js'
import type {
  OverviewFilterSelection,
  OverviewFilterState
} from '#/dashboard/atoms/overview.js'
import styler from '@alinea/styler'
import {IcRoundFilterList, IcRoundKeyboardArrowDown} from '../icons.js'
import css from './ExplorerFilterMenu.module.css'

const styles = styler(css)

export interface ExplorerFilterMenuProps {
  /** The filters editors can apply */
  filters: Array<OverviewFilterState>
  /** The options of the filters the list is filtered by */
  picked: OverviewFilterSelection
  onToggle(filter: OverviewFilterState, option: string): void
  size?: 'default' | 'sm'
}

/** Every filter of a list in one popover, their options as chips */
export function ExplorerFilterMenu({
  filters,
  picked,
  onToggle,
  size = 'default'
}: ExplorerFilterMenuProps) {
  const options = filters.flatMap(filter =>
    filter.options.filter(option => picked[filter.key]?.includes(option.key))
  )
  const label =
    options.length === 0
      ? 'Filter'
      : options.length === 1
        ? `Filter: ${options[0].label}`
        : `Filter: ${options.length}`
  return (
    <Popover>
      <PopoverTrigger
        variant="outline"
        icon={IcRoundFilterList}
        active={options.length > 0}
        size={size}
        className={styles.ExplorerFilterMenu.trigger()}
      >
        {label}
        <Icon
          icon={IcRoundKeyboardArrowDown}
          className={styles.ExplorerFilterMenu.chevron()}
        />
      </PopoverTrigger>
      <PopoverContent aria-label="Filter" side="bottom" align="start">
        <div className={styles.ExplorerFilterMenu()}>
          {filters.map(filter => (
            <div
              key={filter.key}
              role="group"
              aria-label={filter.label}
              className={styles.ExplorerFilterMenu.filter()}
            >
              <span className={styles.ExplorerFilterMenu.filter.label()}>
                {filter.label}
              </span>
              <div className={styles.ExplorerFilterMenu.filter.options()}>
                {filter.options.map(option => (
                  <Toggle
                    key={option.key}
                    size="sm"
                    variant="outline"
                    pressed={Boolean(picked[filter.key]?.includes(option.key))}
                    onPressedChange={() => onToggle(filter, option.key)}
                  >
                    {option.label}
                  </Toggle>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
