import styler from '@alinea/styler'
import {type ChangeEvent, type InputHTMLAttributes, useState} from 'react'
import {IcRoundClose, IcRoundSearch} from '#/dashboard/icons.js'
import css from './SearchField.module.css'

const styles = styler(css)

export interface SearchFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'className' | 'defaultValue' | 'onChange' | 'type' | 'value'
> {
  defaultValue?: string
  hasIcon?: boolean
  onValueChange?: (value: string) => void
  value?: string
}

export function SearchField({
  defaultValue = '',
  disabled,
  hasIcon = true,
  onValueChange,
  value,
  ...props
}: SearchFieldProps) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue)
  const currentValue = value ?? uncontrolledValue

  function updateValue(nextValue: string) {
    setUncontrolledValue(nextValue)
    onValueChange?.(nextValue)
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    updateValue(event.target.value)
  }

  return (
    <div
      className={styles['alinea-SearchField']()}
      data-disabled={disabled ? '' : undefined}
    >
      {hasIcon && (
        <span
          aria-hidden="true"
          className={styles['alinea-SearchField-icon']()}
        >
          <IcRoundSearch />
        </span>
      )}
      <input
        {...props}
        className={styles['alinea-SearchField-input']()}
        disabled={disabled}
        type="search"
        value={currentValue}
        onChange={handleChange}
      />
      <button
        aria-label="Clear search"
        className={styles['alinea-SearchField-clear']()}
        data-empty={currentValue.length === 0 ? '' : undefined}
        type="button"
        onClick={() => updateValue('')}
      >
        <span className={styles['alinea-SearchField-clear-icon']()}>
          <IcRoundClose />
        </span>
      </button>
    </div>
  )
}
