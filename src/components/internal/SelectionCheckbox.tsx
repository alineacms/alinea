import styler from '@alinea/styler'
import {Checkbox} from 'react-aria-components'
import css from './SelectionCheckbox.module.css'

const styles = styler(css)

export interface SelectionCheckboxProps {
  'aria-label'?: string
  /** Set outside a row, eg. to check every row from a header */
  checked?: boolean
  indeterminate?: boolean
  disabled?: boolean
  onCheckedChange?: (checked: boolean) => void
}

/**
 * The checkbox react-aria collections (Table, Tree, GridList) render in their
 * `selection` slot. It gets its state from the surrounding row, unless it is
 * controlled through `checked`.
 */
export function SelectionCheckbox({
  checked,
  indeterminate,
  disabled,
  onCheckedChange,
  ...props
}: SelectionCheckboxProps) {
  return (
    <Checkbox
      {...props}
      isSelected={checked}
      isIndeterminate={indeterminate}
      isDisabled={disabled}
      onChange={onCheckedChange}
      slot={checked === undefined ? 'selection' : undefined}
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
            data-slot="selection-checkbox-mark"
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
