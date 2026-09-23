import styler from '@alinea/styler'
import type {FocusEvent, KeyboardEvent} from 'react'
import {
  Button,
  Group,
  Input,
  NumberField as NumberFieldPrimitive
} from 'react-aria-components'
import {
  IcRoundKeyboardArrowDown,
  IcRoundKeyboardArrowUp
} from '#/dashboard/icons.js'
import {Field} from './Field.js'
import css from './NumberField.module.css'
import type {
  AriaProps,
  DataProps,
  FieldSharedProps,
  StyleProps
} from './types.js'

const styles = styler(css)

export interface NumberFieldProps
  extends FieldSharedProps, StyleProps, AriaProps, DataProps {
  /** The number, or null when the field is empty */
  value?: number | null
  defaultValue?: number | null
  onValueChange?: (value: number | null) => void
  min?: number
  max?: number
  step?: number
  formatOptions?: Intl.NumberFormatOptions
  placeholder?: string
  /** Show increment and decrement buttons, defaults to true */
  steppers?: boolean
  name?: string
  autoFocus?: boolean
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void
  onFocus?: (event: FocusEvent<HTMLInputElement>) => void
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
}

function toInternal(value: number | null | undefined) {
  if (value === undefined) return undefined
  return value ?? Number.NaN
}

export function NumberField({
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
  min,
  max,
  placeholder,
  steppers = true,
  onBlur,
  onFocus,
  onKeyDown,
  className,
  ...props
}: NumberFieldProps) {
  return (
    <NumberFieldPrimitive
      data-slot="number-field"
      {...props}
      value={toInternal(value)}
      defaultValue={toInternal(defaultValue)}
      onChange={next => onValueChange?.(Number.isNaN(next) ? null : next)}
      minValue={min}
      maxValue={max}
      isRequired={required}
      isDisabled={disabled}
      isReadOnly={readOnly}
      isInvalid={Boolean(error)}
      className={styles.NumberField(styler.merge({className}))}
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
        <Group
          data-slot="number-field-group"
          className={styles.NumberFieldGroup()}
        >
          <Input
            data-slot="number-field-input"
            className={styles.NumberFieldInput()}
            placeholder={placeholder}
            onBlur={onBlur}
            onFocus={onFocus}
            onKeyDown={onKeyDown}
          />
          {steppers && (
            <div
              data-slot="number-field-steppers"
              className={styles.NumberFieldSteppers()}
            >
              <Button
                slot="increment"
                data-slot="number-field-increment"
                className={styles.NumberFieldStepper()}
              >
                <IcRoundKeyboardArrowUp />
              </Button>
              <Button
                slot="decrement"
                data-slot="number-field-decrement"
                className={styles.NumberFieldStepper()}
              >
                <IcRoundKeyboardArrowDown />
              </Button>
            </div>
          )}
        </Group>
      </Field>
    </NumberFieldPrimitive>
  )
}
