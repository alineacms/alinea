import styler from '@alinea/styler'
import {Checkbox} from 'react-aria-components'
import css from './SelectionCheckbox.module.css'

const styles = styler(css)

export interface SelectionCheckboxProps {
  'aria-label'?: string
}

/**
 * The checkbox react-aria collections (Table, Tree, GridList) render in their
 * `selection` slot. It gets its state from the surrounding row.
 */
export function SelectionCheckbox(props: SelectionCheckboxProps) {
  return (
    <Checkbox
      {...props}
      slot="selection"
      data-slot="selection-checkbox"
      // react-aria focuses the hidden input from script, so :focus-visible
      // also matches after a pointer press; isFocusVisible follows the modality
      className={({isFocusVisible}) =>
        styles.SelectionCheckbox({focusVisible: isFocusVisible})
      }
    >
      {({isIndeterminate}) => (
        <span
          data-slot="selection-checkbox-indicator"
          className={styles.SelectionCheckbox.box()}
        >
          <svg
            className={styles.SelectionCheckbox.mark()}
            viewBox="0 0 18 18"
            aria-hidden="true"
          >
            {isIndeterminate ? (
              <rect x={1} y={7.5} width={15} height={3} />
            ) : (
              <polyline points="1 9 7 14 15 4" />
            )}
          </svg>
        </span>
      )}
    </Checkbox>
  )
}
