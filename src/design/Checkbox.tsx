import styler from '@alinea/styler'
import {
  type ChangeEvent,
  type InputHTMLAttributes,
  useEffect,
  useRef,
  useState
} from 'react'
import css from './Checkbox.module.css'

const styles = styler(css)

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'checked' | 'className' | 'defaultChecked' | 'onChange' | 'type'
> {
  defaultSelected?: boolean
  description?: string
  indeterminate?: boolean
  invalid?: boolean
  label: string
  onSelectedChange?: (selected: boolean) => void
  selected?: boolean
}

export function Checkbox({
  defaultSelected = false,
  description,
  disabled,
  indeterminate,
  invalid,
  label,
  onSelectedChange,
  selected,
  ...props
}: CheckboxProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uncontrolledSelected, setUncontrolledSelected] =
    useState(defaultSelected)
  const isSelected = selected ?? uncontrolledSelected

  useEffect(() => {
    if (inputRef.current)
      inputRef.current.indeterminate = Boolean(indeterminate)
  }, [indeterminate])

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setUncontrolledSelected(event.target.checked)
    onSelectedChange?.(event.target.checked)
  }

  return (
    <label
      className={styles['alinea-Checkbox']()}
      data-disabled={disabled ? '' : undefined}
      data-indeterminate={indeterminate ? '' : undefined}
      data-invalid={invalid ? '' : undefined}
      data-selected={isSelected ? '' : undefined}
    >
      <input
        {...props}
        aria-invalid={invalid || undefined}
        checked={isSelected}
        className={styles['alinea-Checkbox-input']()}
        disabled={disabled}
        ref={inputRef}
        type="checkbox"
        onChange={handleChange}
      />
      <span className={styles['alinea-Checkbox-box']()}>
        <svg
          aria-hidden="true"
          className={styles['alinea-Checkbox-mark']()}
          viewBox="0 0 18 18"
        >
          {indeterminate ? (
            <rect height="3" width="15" x="1" y="7.5" />
          ) : (
            <polyline points="1 9 7 14 15 4" />
          )}
        </svg>
      </span>
      <span className={styles['alinea-Checkbox-copy']()}>
        <span className={styles['alinea-Checkbox-label']()}>{label}</span>
        {description && (
          <span className={styles['alinea-Checkbox-description']()}>
            {description}
          </span>
        )}
      </span>
    </label>
  )
}
