import styler from '@alinea/styler'
import {
  DateInput,
  DateField as DateFieldPrimitive,
  DateSegment,
  Group
} from 'react-aria-components'
import css from './DateField.module.css'
import {Field} from './Field.js'
import {toCalendarDate} from './internal/DateValue.js'
import type {
  AriaProps,
  DataProps,
  FieldSharedProps,
  StyleProps
} from './types.js'

const styles = styler(css)

export interface DateFieldProps
  extends FieldSharedProps, StyleProps, AriaProps, DataProps {
  /** The date, `YYYY-MM-DD` */
  value?: string | null
  defaultValue?: string | null
  onValueChange?: (value: string | null) => void
  /** The earliest valid date, `YYYY-MM-DD` */
  min?: string
  /** The latest valid date, `YYYY-MM-DD` */
  max?: string
  name?: string
  autoFocus?: boolean
}

export function DateField({
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
  className,
  ...props
}: DateFieldProps) {
  return (
    <DateFieldPrimitive
      data-slot="date-field"
      {...props}
      className={styles.DateField(styler.merge({className}))}
      value={toCalendarDate(value)}
      defaultValue={toCalendarDate(defaultValue)}
      onChange={
        onValueChange && (date => onValueChange(date ? date.toString() : null))
      }
      minValue={toCalendarDate(min)}
      maxValue={toCalendarDate(max)}
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
        <Group
          data-slot="date-field-control"
          aria-disabled={disabled || undefined}
          className={styles.DateField.control()}
        >
          <DateInput
            data-slot="date-field-input"
            className={styles.DateField.input()}
          >
            {segment => (
              <DateSegment
                data-slot="date-field-segment"
                className={state =>
                  styles.DateField.segment({placeholder: state.isPlaceholder})
                }
                segment={segment}
              />
            )}
          </DateInput>
        </Group>
      </Field>
    </DateFieldPrimitive>
  )
}
