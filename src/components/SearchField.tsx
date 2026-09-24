import styler from '@alinea/styler'
import type {FocusEvent, KeyboardEvent} from 'react'
import {
  Button,
  Input,
  SearchField as SearchFieldPrimitive
} from 'react-aria-components'
import {IcRoundClose} from '#/dashboard/icons.js'
import {Field} from './Field.js'
import {Icon} from './Icon.js'
import css from './SearchField.module.css'
import {Spinner} from './Spinner.js'
import type {
  AriaProps,
  DataProps,
  FieldSharedProps,
  StyleProps
} from './types.js'

const styles = styler(css)

export interface SearchFieldProps
  extends FieldSharedProps, StyleProps, AriaProps, DataProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  /** Called when the user presses enter */
  onSubmit?: (value: string) => void
  /** Called when the user clears the field with the clear button or escape */
  onClear?: () => void
  placeholder?: string
  /** Shows a spinner while results are being loaded */
  loading?: boolean
  name?: string
  autoFocus?: boolean
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void
  onFocus?: (event: FocusEvent<HTMLInputElement>) => void
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
  /**
   * Set to `combobox` when the field controls a list of results that is
   * navigated with the arrow keys while focus stays in the field (together
   * with `aria-controls` and `aria-activedescendant`), defaults to `searchbox`
   */
  role?: 'searchbox' | 'combobox'
  /** The id of the results a combobox controls */
  'aria-controls'?: string
  /** The id of the active result within the results a combobox controls */
  'aria-activedescendant'?: string
  /** Whether the results a combobox controls are shown */
  'aria-expanded'?: boolean
  /** The kind of element holding the results a combobox controls */
  'aria-haspopup'?: 'listbox' | 'grid' | 'tree' | 'dialog'
  'aria-autocomplete'?: 'list' | 'none'
}

/**
 * A text input for search queries with a clear button. The `icon` is shown
 * inside the input, in front of the query.
 */
export function SearchField({
  label,
  description,
  error,
  required,
  disabled,
  readOnly,
  icon,
  shared,
  onValueChange,
  placeholder,
  loading,
  onBlur,
  onFocus,
  onKeyDown,
  role,
  'aria-controls': ariaControls,
  'aria-activedescendant': ariaActiveDescendant,
  'aria-expanded': ariaExpanded,
  'aria-haspopup': ariaHasPopup,
  'aria-autocomplete': ariaAutocomplete,
  className,
  ...props
}: SearchFieldProps) {
  return (
    <SearchFieldPrimitive
      data-slot="search-field"
      {...props}
      onChange={onValueChange}
      isRequired={required}
      isDisabled={disabled}
      isReadOnly={readOnly}
      isInvalid={Boolean(error)}
      className={styles.SearchField(styler.merge({className}))}
    >
      <Field
        label={label}
        description={description}
        error={error}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        shared={shared}
      >
        <div
          data-slot="search-field-group"
          className={styles.SearchFieldGroup()}
        >
          {icon && (
            <Icon
              icon={icon}
              data-slot="search-field-icon"
              className={styles.SearchFieldIcon()}
            />
          )}
          <Input
            data-slot="search-field-input"
            className={styles.SearchFieldInput()}
            placeholder={placeholder}
            onBlur={onBlur}
            onFocus={onFocus}
            onKeyDown={onKeyDown}
            role={role === 'combobox' ? role : undefined}
            aria-controls={ariaControls}
            aria-activedescendant={ariaActiveDescendant}
            aria-expanded={
              role === 'combobox' ? Boolean(ariaExpanded) : undefined
            }
            aria-haspopup={ariaHasPopup}
            aria-autocomplete={ariaAutocomplete}
          />
          {loading && (
            <Spinner
              aria-label="Loading results"
              className={styles.SearchFieldSpinner()}
            />
          )}
          <Button
            data-slot="search-field-clear"
            className={styles.SearchFieldClear()}
          >
            <Icon
              icon={IcRoundClose}
              className={styles.SearchFieldClear.icon()}
            />
          </Button>
        </div>
      </Field>
    </SearchFieldPrimitive>
  )
}
