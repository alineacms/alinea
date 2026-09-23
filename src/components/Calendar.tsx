import styler from '@alinea/styler'
import {type DateValue, getDayOfWeek, parseDate} from '@internationalized/date'
import {useLocale} from 'react-aria'
import {
  Button,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  Calendar as CalendarPrimitive,
  Heading,
  RangeCalendar as RangeCalendarPrimitive
} from 'react-aria-components'
import {
  IcRoundKeyboardArrowLeft,
  IcRoundKeyboardArrowRight
} from '../dashboard/icons.js'
import {Locale} from './internal/Locale.js'
import css from './Calendar.module.css'
import {Icon} from './Icon.js'
import {toCalendarDate, toCalendarRange} from './internal/DateValue.js'
import type {AriaProps, DataProps, DateRange, StyleProps} from './types.js'

const styles = styler(css)

interface CalendarSharedProps extends StyleProps, AriaProps, DataProps {
  /** BCP 47 locale used to format dates, eg. `en-GB`, defaults to the user's locale */
  locale?: string
  /** The earliest selectable date, `YYYY-MM-DD` */
  min?: string
  /** The latest selectable date, `YYYY-MM-DD` */
  max?: string
  disabled?: boolean
  readOnly?: boolean
  autoFocus?: boolean
  /** Marks dates that cannot be selected, receives `YYYY-MM-DD` */
  isDateUnavailable?: (date: string) => boolean
}

export interface CalendarProps extends CalendarSharedProps {
  /** The selected date, `YYYY-MM-DD` */
  value?: string | null
  defaultValue?: string | null
  onValueChange?: (value: string) => void
}

export function Calendar({
  value,
  defaultValue,
  onValueChange,
  className,
  locale,
  ...props
}: CalendarProps) {
  return (
    <Locale locale={locale}>
      <CalendarPrimitive
        data-slot="calendar"
        {...calendarProps(props)}
        className={styles.Calendar(styler.merge({className}))}
        value={toCalendarDate(value)}
        defaultValue={toCalendarDate(defaultValue)}
        onChange={onValueChange && (date => onValueChange(date.toString()))}
      >
        <CalendarBody />
      </CalendarPrimitive>
    </Locale>
  )
}

export interface RangeCalendarProps extends CalendarSharedProps {
  value?: DateRange | null
  defaultValue?: DateRange | null
  onValueChange?: (value: DateRange) => void
}

export function RangeCalendar({
  value,
  defaultValue,
  onValueChange,
  className,
  locale,
  ...props
}: RangeCalendarProps) {
  return (
    <Locale locale={locale}>
      <RangeCalendarPrimitive
        data-slot="calendar"
        data-range
        {...calendarProps(props)}
        className={styles.Calendar(styler.merge({className}))}
        value={toCalendarRange(value)}
        defaultValue={toCalendarRange(defaultValue)}
        onChange={
          onValueChange &&
          (range =>
            onValueChange({
              start: range.start.toString(),
              end: range.end.toString()
            }))
        }
      >
        <CalendarBody />
      </RangeCalendarPrimitive>
    </Locale>
  )
}

function calendarProps({
  min,
  max,
  disabled,
  readOnly,
  isDateUnavailable,
  ...props
}: Omit<CalendarSharedProps, 'className'>) {
  return {
    ...props,
    minValue: toCalendarDate(min),
    maxValue: toCalendarDate(max),
    isDisabled: disabled,
    isReadOnly: readOnly,
    isDateUnavailable:
      isDateUnavailable &&
      ((date: DateValue) => isDateUnavailable(date.toString()))
  }
}

function CalendarBody() {
  const {locale} = useLocale()
  return (
    <>
      <header data-slot="calendar-header" className={styles.Calendar.header()}>
        <Button
          slot="previous"
          data-slot="calendar-previous"
          className={styles.Calendar.nav()}
        >
          <Icon icon={IcRoundKeyboardArrowLeft} />
        </Button>
        <Heading
          data-slot="calendar-heading"
          className={styles.Calendar.heading()}
        />
        <Button
          slot="next"
          data-slot="calendar-next"
          className={styles.Calendar.nav()}
        >
          <Icon icon={IcRoundKeyboardArrowRight} />
        </Button>
      </header>
      <CalendarGrid
        data-slot="calendar-grid"
        className={styles.Calendar.grid()}
      >
        <CalendarGridHeader>
          {day => (
            <CalendarHeaderCell
              data-slot="calendar-weekday"
              className={styles.Calendar.weekday()}
            >
              {day}
            </CalendarHeaderCell>
          )}
        </CalendarGridHeader>
        <CalendarGridBody>
          {date => {
            // react-aria ships its own copy of @internationalized/date
            const day = getDayOfWeek(parseDate(date.toString()), locale)
            return (
              <CalendarCell
                data-slot="calendar-day"
                date={date}
                className={state =>
                  styles.Calendar.day({
                    selected: state.isSelected,
                    today: state.isToday,
                    unavailable: state.isUnavailable,
                    rangeStart: state.isSelectionStart,
                    rangeEnd: state.isSelectionEnd,
                    weekStart: day === 0,
                    weekEnd: day === 6
                  })
                }
              />
            )
          }}
        </CalendarGridBody>
      </CalendarGrid>
    </>
  )
}
