import styler from '@alinea/styler'
import {
  DateInput,
  DateSegment,
  TimeField as TimeFieldPrimitive
} from 'react-aria-components'
import {Field} from './Field.js'
import {formatTime, toTime} from './internal/DateValue.js'
import {Locale} from './internal/Locale.js'
import css from './TimeField.module.css'
import type {
  AriaProps,
  DataProps,
  FieldSharedProps,
  StyleProps
} from './types.js'

const styles = styler(css)

export interface TimeFieldProps
  extends FieldSharedProps, StyleProps, AriaProps, DataProps {
  /** BCP 47 locale used to format dates, eg. `en-GB`, defaults to the user's locale */
  locale?: string
  /** The time, `HH:mm` or `HH:mm:ss` */
  value?: string | null
  defaultValue?: string | null
  /** Receives `HH:mm`, or `HH:mm:ss` when granularity is `second` */
  onValueChange?: (value: string | null) => void
  /** The earliest valid time, `HH:mm` or `HH:mm:ss` */
  min?: string
  /** The latest valid time, `HH:mm` or `HH:mm:ss` */
  max?: string
  /** The smallest unit that can be edited, defaults to `minute` */
  granularity?: 'minute' | 'second'
  /** Defaults to the locale's hour cycle */
  hourCycle?: 12 | 24
  name?: string
  autoFocus?: boolean
}

export function TimeField({
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
  granularity = 'minute',
  className,
  locale,
  ...props
}: TimeFieldProps) {
  return (
    <Locale locale={locale}>
      <TimeFieldPrimitive
        data-slot="time-field"
        {...props}
        className={styles.TimeField(styler.merge({className}))}
        value={toTime(value)}
        defaultValue={toTime(defaultValue)}
        onChange={
          onValueChange &&
          (time => onValueChange(time ? formatTime(time, granularity) : null))
        }
        minValue={toTime(min)}
        maxValue={toTime(max)}
        granularity={granularity}
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
          <DateInput
            data-slot="time-field-input"
            className={styles.TimeField.input()}
          >
            {segment => (
              <DateSegment
                data-slot="time-field-segment"
                className={state =>
                  styles.TimeField.segment({
                    placeholder: state.isPlaceholder,
                    literal: segment.type === 'literal'
                  })
                }
                segment={segment}
              />
            )}
          </DateInput>
        </Field>
      </TimeFieldPrimitive>
    </Locale>
  )
}
