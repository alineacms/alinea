import type {DateValue} from '@internationalized/date'
import {DatePicker as DatePickerPrimitive} from 'react-aria-components'
import {Calendar} from './Calendar.js'
import {Field} from './Field.js'
import {DateControl, DateControlInput} from './internal/DateControl.js'
import {toCalendarDate} from './internal/DateValue.js'
import {Locale} from './internal/Locale.js'
import type {
  AriaProps,
  DataProps,
  FieldSharedProps,
  StyleProps
} from './types.js'

export interface DatePickerProps
  extends FieldSharedProps, StyleProps, AriaProps, DataProps {
  /** BCP 47 locale used to format dates, eg. `en-GB`, defaults to the user's locale */
  locale?: string
  /** The selected date, `YYYY-MM-DD` */
  value?: string | null
  defaultValue?: string | null
  onValueChange?: (value: string | null) => void
  /** The earliest selectable date, `YYYY-MM-DD` */
  min?: string
  /** The latest selectable date, `YYYY-MM-DD` */
  max?: string
  /** Returns true for dates that cannot be selected, receives `YYYY-MM-DD` */
  disabledDates?: (date: string) => boolean
  name?: string
  autoFocus?: boolean
}

export function DatePicker({
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
  disabledDates,
  className,
  locale,
  ...props
}: DatePickerProps) {
  return (
    <Locale locale={locale}>
      <DatePickerPrimitive
        data-slot="date-picker"
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
        isDateUnavailable={
          disabledDates && ((date: DateValue) => disabledDates(date.toString()))
        }
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
          <DateControl dataSlot="date-picker" calendar={<Calendar />}>
            <DateControlInput dataSlot="date-picker" />
          </DateControl>
        </Field>
      </DatePickerPrimitive>
    </Locale>
  )
}
