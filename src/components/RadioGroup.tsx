import styler from '@alinea/styler'
import type {ReactNode} from 'react'
import {
  RadioGroup as RadioGroupPrimitive,
  Radio as RadioPrimitive
} from 'react-aria-components'
import {Field, FieldDescription} from './Field.js'
import css from './RadioGroup.module.css'
import type {
  AriaProps,
  DataProps,
  FieldSharedProps,
  Orientation,
  StyleProps
} from './types.js'

const styles = styler(css)

export interface RadioGroupProps
  extends FieldSharedProps, StyleProps, AriaProps, DataProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  orientation?: Orientation
  name?: string
  /** `RadioGroupItem` elements */
  children?: ReactNode
}

export function RadioGroup({
  label,
  description,
  error,
  required,
  disabled,
  readOnly,
  icon,
  shared,
  value,
  defaultValue,
  onValueChange,
  orientation = 'vertical',
  className,
  children,
  ...props
}: RadioGroupProps) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      {...props}
      className={styles.RadioGroup(styler.merge({className}))}
      value={value}
      defaultValue={defaultValue}
      onChange={onValueChange}
      orientation={orientation}
      isRequired={required}
      isDisabled={disabled}
      isReadOnly={readOnly}
      isInvalid={error ? true : undefined}
    >
      <Field
        label={label}
        description={description}
        error={error}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        icon={icon}
        shared={shared}
      >
        <div
          data-slot="radio-group-items"
          data-orientation={orientation}
          className={styles.RadioGroup.items()}
        >
          {children}
        </div>
      </Field>
    </RadioGroupPrimitive>
  )
}

export interface RadioGroupItemProps extends StyleProps, AriaProps, DataProps {
  value: string
  disabled?: boolean
  autoFocus?: boolean
  description?: ReactNode
  /** The label */
  children?: ReactNode
}

export function RadioGroupItem({
  disabled,
  description,
  className,
  children,
  ...props
}: RadioGroupItemProps) {
  return (
    <RadioPrimitive
      data-slot="radio-group-item"
      {...props}
      // react-aria focuses the hidden input from script, so :focus-visible
      // also matches after a pointer press; isFocusVisible follows the modality
      className={({isFocusVisible}) =>
        styles.RadioGroupItem(
          {focusVisible: isFocusVisible},
          styler.merge({className})
        )
      }
      isDisabled={disabled}
    >
      <span
        data-slot="radio-group-indicator"
        className={styles.RadioGroupItem.indicator()}
      />
      {(children || description) && (
        <span
          data-slot="radio-group-item-content"
          className={styles.RadioGroupItem.content()}
        >
          {children && (
            <span
              data-slot="radio-group-item-label"
              className={styles.RadioGroupItem.label()}
            >
              {children}
            </span>
          )}
          {description && <FieldDescription>{description}</FieldDescription>}
        </span>
      )}
    </RadioPrimitive>
  )
}
