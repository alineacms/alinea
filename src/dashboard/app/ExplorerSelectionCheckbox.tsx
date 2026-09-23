import styler from '@alinea/styler'
import {Checkbox} from 'react-aria-components'
import css from './ExplorerSelectionCheckbox.module.css'

const styles = styler(css)

export interface ExplorerSelectionCheckboxProps {
  label: string
  className?: string
}

/**
 * The row selection checkbox of the explorer grids. It uses react-aria's
 * Checkbox directly so it can fill the `selection` slot of a GridList row,
 * which the public Checkbox does not expose.
 */
export function ExplorerSelectionCheckbox({
  label,
  className
}: ExplorerSelectionCheckboxProps) {
  return (
    <Checkbox
      slot="selection"
      aria-label={`Select ${label}`}
      className={styles.ExplorerSelectionCheckbox(styler.merge({className}))}
    >
      <span className={styles.ExplorerSelectionCheckbox.box()}>
        <svg
          className={styles.ExplorerSelectionCheckbox.mark()}
          viewBox="0 0 18 18"
          aria-hidden="true"
        >
          <polyline points="1 9 7 14 15 4" />
        </svg>
      </span>
    </Checkbox>
  )
}
