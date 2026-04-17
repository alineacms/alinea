import styler from '@alinea/styler'
import {
  Button,
  CalendarCell,
  CalendarGrid,
  Calendar as CalendarPrimitive,
  type CalendarProps as CalendarPrimitiveProps,
  type DateValue,
  Heading,
  RangeCalendar as RangeCalendarPrimitive,
  type RangeCalendarProps
} from 'react-aria-components'
import {
  IcRoundKeyboardArrowLeft,
  IcRoundKeyboardArrowRight
} from '../v2/icons.js'
import css from './Calendar.module.css'
import {Icon} from './Icon.js'

const styles = styler(css)

export function Calendar<T extends DateValue>(
  props: CalendarPrimitiveProps<T>
) {
  const {className, ...rest} = props
  return (
    <CalendarPrimitive
      {...rest}
      className={renderProps =>
        styles.Calendar(
          styler.merge({
            className:
              typeof className === 'function'
                ? className(renderProps)
                : className
          })
        )
      }
    >
      <header className={styles.Calendar.header()}>
        <Button slot="previous" className={styles.Calendar.button()}>
          <Icon icon={IcRoundKeyboardArrowLeft} />
        </Button>
        <Heading className={styles.Calendar.heading()} />
        <Button slot="next" className={styles.Calendar.button()}>
          <Icon icon={IcRoundKeyboardArrowRight} />
        </Button>
      </header>
      <CalendarGrid className={styles.Calendar.grid()}>
        {date => (
          <CalendarCell date={date} className={styles.Calendar.cell()} />
        )}
      </CalendarGrid>
    </CalendarPrimitive>
  )
}

export function RangeCalendar<T extends DateValue>(
  props: RangeCalendarProps<T>
) {
  const {className, ...rest} = props
  return (
    <RangeCalendarPrimitive
      {...rest}
      className={renderProps =>
        styles.Calendar(
          styler.merge({
            className:
              typeof className === 'function'
                ? className(renderProps)
                : className
          })
        )
      }
    >
      <header className={styles.Calendar.header()}>
        <Button slot="previous" className={styles.Calendar.button()}>
          <Icon icon={IcRoundKeyboardArrowLeft} />
        </Button>
        <Heading className={styles.Calendar.heading()} />
        <Button slot="next" className={styles.Calendar.button()}>
          <Icon icon={IcRoundKeyboardArrowRight} />
        </Button>
      </header>
      <CalendarGrid className={styles.Calendar.grid()}>
        {date => (
          <CalendarCell date={date} className={styles.Calendar.cell()} />
        )}
      </CalendarGrid>
    </RangeCalendarPrimitive>
  )
}
