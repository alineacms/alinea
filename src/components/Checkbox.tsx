import styler from '@alinea/styler'
import {type ReactNode, type Ref, useId} from 'react'
import {Checkbox as CheckboxPrimitive, TextContext} from 'react-aria-components'
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
  'aria-describedby': ariaDescribedBy,
  ...props
}: CheckboxProps) {
  const indeterminate = checked === 'indeterminate'
  const id = useId()
  const descriptionId = description ? `${id}-description` : undefined
  const errorId = error ? `${id}-error` : undefined
  return (
    <CheckboxPrimitive
      data-slot="checkbox"
      {...props}
      aria-describedby={
        [descriptionId, errorId, ariaDescribedBy].filter(Boolean).join(' ') ||
        undefined
      }
      // react-aria focuses the hidden input from script, so :focus-visible
      // also matches after a pointer press; isFocusVisible follows the modality
      className={({isFocusVisible}) =>
        styles.Checkbox(
          {focusVisible: isFocusVisible},
          styler.merge({className})
        )
      }
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
          data-slot="checkbox-mark"
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
          <TextContext.Provider
            value={{
              slots: {
                description: {id: descriptionId},
                errorMessage: {id: errorId}
              }
            }}
          >
            {description && <FieldDescription>{description}</FieldDescription>}
            {error && <FieldError>{error}</FieldError>}
          </TextContext.Provider>
        </span>
      )}
    </CheckboxPrimitive>
  )
}
