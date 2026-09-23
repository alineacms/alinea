import styler from '@alinea/styler'
import type {ReactNode, Ref} from 'react'
import {Checkbox as CheckboxPrimitive} from 'react-aria-components'
import css from './Checkbox.module.css'
import {FieldDescription, FieldError} from './Field.js'
import type {AriaProps, DataProps, StyleProps} from './types.js'

const styles = styler(css)

export interface CheckboxProps extends StyleProps, AriaProps, DataProps {
  checked?: boolean | 'indeterminate'
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  required?: boolean
  readOnly?: boolean
  name?: string
  /** Submitted value, and the value inside a `CheckboxGroup` */
  value?: string
  autoFocus?: boolean
  description?: ReactNode
  error?: ReactNode
  ref?: Ref<HTMLLabelElement>
  /** The label */
  children?: ReactNode
}

export function Checkbox({
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  required,
  readOnly,
  description,
  error,
  className,
  children,
  ...props
}: CheckboxProps) {
  const indeterminate = checked === 'indeterminate'
  return (
    <CheckboxPrimitive
      data-slot="checkbox"
      {...props}
      className={styles.Checkbox(styler.merge({className}))}
      isSelected={checked === undefined ? undefined : checked === true}
      isIndeterminate={indeterminate}
      defaultSelected={defaultChecked}
      onChange={onCheckedChange}
      isDisabled={disabled}
      isRequired={required}
      isReadOnly={readOnly}
      isInvalid={error ? true : undefined}
    >
      <span data-slot="checkbox-indicator" className={styles.Checkbox.box()}>
        <svg
          className={styles.Checkbox.mark()}
          viewBox="0 0 18 18"
          aria-hidden="true"
        >
          {indeterminate ? (
            <rect x={1} y={7.5} width={15} height={3} />
          ) : (
            <polyline points="1 9 7 14 15 4" />
          )}
        </svg>
      </span>
      {(children || description || error) && (
        <span
          data-slot="checkbox-content"
          className={styles.Checkbox.content()}
        >
          {children && (
            <span
              data-slot="checkbox-label"
              className={styles.Checkbox.label()}
            >
              {children}
            </span>
          )}
          {description && <FieldDescription>{description}</FieldDescription>}
          {error && <FieldError>{error}</FieldError>}
        </span>
      )}
    </CheckboxPrimitive>
  )
}
