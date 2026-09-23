import styler from '@alinea/styler'
import type {DateValue} from '@internationalized/date'
import {
  Button,
  DateInput,
  DateRangePicker as DateRangePickerPrimitive,
  DateSegment,
  Dialog,
  Group
} from 'react-aria-components'
import {IcRoundDateRange} from '../dashboard/icons.js'
import {RangeCalendar} from './Calendar.js'
import {Locale} from './internal/Locale.js'
import css from './DateRangePicker.module.css'
import {Field} from './Field.js'
import {Icon} from './Icon.js'
import {toCalendarDate, toCalendarRange} from './internal/DateValue.js'
import {PopoverSurface} from './internal/PopoverSurface.js'
import type {
  AriaProps,
  DataProps,
  DateRange,
  FieldSharedProps,
  StyleProps
} from './types.js'

const styles = styler(css)

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
  /** Marks dates that cannot be selected, receives `YYYY-MM-DD` */
  isDateUnavailable?: (date: string) => boolean
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
  isDateUnavailable,
  className,
  locale,
  ...props
}: DateRangePickerProps) {
  return (
    <Locale locale={locale}>
      <DateRangePickerPrimitive
        data-slot="date-range-picker"
        {...props}
        className={styles.DateRangePicker(styler.merge({className}))}
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
          isDateUnavailable &&
          ((date: DateValue) => isDateUnavailable(date.toString()))
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
          <Group
            data-slot="date-range-picker-control"
            aria-disabled={disabled || undefined}
            className={styles.DateRangePicker.control()}
          >
            <div
              data-slot="date-range-picker-inputs"
              className={styles.DateRangePicker.inputs()}
            >
              <DateRangePickerInput slot="start" />
              <span
                aria-hidden="true"
                data-slot="date-range-picker-separator"
                className={styles.DateRangePicker.separator()}
              >
                –
              </span>
              <DateRangePickerInput slot="end" />
            </div>
            <Button
              data-slot="date-range-picker-trigger"
              className={styles.DateRangePicker.trigger()}
            >
              <Icon
                icon={IcRoundDateRange}
                className={styles.DateRangePicker.icon()}
              />
            </Button>
          </Group>
        </Field>
        <PopoverSurface data-slot="date-range-picker-content">
          <Dialog className={styles.DateRangePicker.dialog()}>
            <RangeCalendar />
          </Dialog>
        </PopoverSurface>
      </DateRangePickerPrimitive>
    </Locale>
  )
}

interface DateRangePickerInputProps {
  slot: 'start' | 'end'
}

function DateRangePickerInput({slot}: DateRangePickerInputProps) {
  return (
    <DateInput
      slot={slot}
      data-slot="date-range-picker-input"
      className={styles.DateRangePicker.input()}
    >
      {segment => (
        <DateSegment
          data-slot="date-range-picker-segment"
          className={state =>
            styles.DateRangePicker.segment({placeholder: state.isPlaceholder})
          }
          segment={segment}
        />
      )}
    </DateInput>
  )
}
