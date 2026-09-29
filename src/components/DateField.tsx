import {DateField as DateFieldPrimitive} from 'react-aria-components'
import {Field} from './Field.js'
import {DateControlInput} from './internal/DateControl.js'
import {toCalendarDate} from './internal/DateValue.js'
import {Locale} from './internal/Locale.js'
import type {
  AriaProps,
  DataProps,
  FieldSharedProps,
  StyleProps
} from './types.js'

export interface DateFieldProps
  extends FieldSharedProps, StyleProps, AriaProps, DataProps {
  /** BCP 47 locale used to format dates, eg. `en-GB`, defaults to the user's locale */
  locale?: string
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
  locale,
  ...props
}: DateFieldProps) {
  return (
    <Locale locale={locale}>
      <DateFieldPrimitive
        data-slot="date-field"
        {...props}
        className={className}
        value={toCalendarDate(value)}
        defaultValue={toCalendarDate(defaultValue)}
        onChange={
          onValueChange &&
          (date => onValueChange(date ? date.toString() : null))
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
          <DateControlInput dataSlot="date-field" framed />
        </Field>
      </DateFieldPrimitive>
    </Locale>
  )
}
