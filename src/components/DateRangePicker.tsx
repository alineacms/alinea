import type {DateValue} from '@internationalized/date'
import {DateRangePicker as DateRangePickerPrimitive} from 'react-aria-components'
import {RangeCalendar} from './Calendar.js'
import {Field} from './Field.js'
import {DateControl, DateControlInput} from './internal/DateControl.js'
import {toCalendarDate, toCalendarRange} from './internal/DateValue.js'
import {Locale} from './internal/Locale.js'
import type {
  AriaProps,
  DataProps,
  DateRange,
  FieldSharedProps,
  StyleProps
} from './types.js'

export interface DateRangePickerProps
  extends FieldSharedProps, StyleProps, AriaProps, DataProps {
  /** BCP 47 locale used to format dates, eg. `en-GB`, defaults to the user's locale */
  locale?: string
  value?: DateRange | null
  defaultValue?: DateRange | null
  onValueChange?: (value: DateRange | null) => void
  /** The earliest selectable date, `YYYY-MM-DD` */
  min?: string
  /** The latest selectable date, `YYYY-MM-DD` */
  max?: string
  /** Returns true for dates that cannot be selected, receives `YYYY-MM-DD` */
  disabledDates?: (date: string) => boolean
  /** Form field name of the start date */
  startName?: string
  /** Form field name of the end date */
  endName?: string
  autoFocus?: boolean
}

export function DateRangePicker({
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
}: DateRangePickerProps) {
  return (
    <Locale locale={locale}>
      <DateRangePickerPrimitive
        data-slot="date-range-picker"
        {...props}
        className={className}
        value={toCalendarRange(value)}
        defaultValue={toCalendarRange(defaultValue)}
        onChange={
          onValueChange &&
          (range =>
            onValueChange(
              range
                ? {start: range.start.toString(), end: range.end.toString()}
                : null
            ))
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
          <DateControl
            dataSlot="date-range-picker"
            calendar={<RangeCalendar />}
          >
            <DateControlInput dataSlot="date-range-picker" slot="start" />
            <span aria-hidden="true" data-slot="date-range-picker-separator">
              –
            </span>
            <DateControlInput dataSlot="date-range-picker" slot="end" />
          </DateControl>
        </Field>
      </DateRangePickerPrimitive>
    </Locale>
  )
}
