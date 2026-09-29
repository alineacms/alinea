import styler from '@alinea/styler'
import type {DateValue} from '@internationalized/date'
import {
  Button,
  DateInput,
  DatePicker as DatePickerPrimitive,
  DateSegment,
  Dialog,
  Group
} from 'react-aria-components'
import {IcRoundDateRange} from '#/dashboard/icons.js'
import {Calendar} from './Calendar.js'
import {Locale} from './internal/Locale.js'
import css from './DatePicker.module.css'
import {Field} from './Field.js'
import {Icon} from './Icon.js'
import {toCalendarDate} from './internal/DateValue.js'
import {PopoverSurface} from './internal/PopoverSurface.js'
import type {
  AriaProps,
  DataProps,
  FieldSharedProps,
  StyleProps
} from './types.js'

const styles = styler(css)

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
        className={styles.DatePicker(styler.merge({className}))}
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
          <Group
            data-slot="date-picker-control"
            aria-disabled={disabled || undefined}
            className={styles.DatePicker.control()}
          >
            <DateInput
              data-slot="date-picker-input"
              className={styles.DatePicker.input()}
            >
              {segment => (
                <DateSegment
                  data-slot="date-picker-segment"
                  className={state =>
                    styles.DatePicker.segment({
                      placeholder: state.isPlaceholder
                    })
                  }
                  segment={segment}
                />
              )}
            </DateInput>
            <Button
              data-slot="date-picker-trigger"
              className={styles.DatePicker.trigger()}
            >
              <Icon
                icon={IcRoundDateRange}
                className={styles.DatePicker.icon()}
              />
            </Button>
          </Group>
        </Field>
        <PopoverSurface data-slot="date-picker-content">
          <Dialog className={styles.DatePicker.dialog()}>
            <Calendar />
          </Dialog>
        </PopoverSurface>
      </DatePickerPrimitive>
    </Locale>
  )
}
