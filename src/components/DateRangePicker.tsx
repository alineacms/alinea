import styler from '@alinea/styler'
import {
  type DateRangePickerProps as AriaDateRangePickerProps,
  Button,
  DateInput,
  DateRangePicker as DateRangePickerPrimitive,
  DateSegment,
  type DateValue,
  Dialog,
  Group
} from 'react-aria-components'
import {IcRoundDateRange as IcRoundCalendarMonth} from '../v2/icons.js'
import {RangeCalendar} from './Calendar.js'
import css from './DateRangePicker.module.css'
import {Icon} from './Icon.js'
import {Label, type LabelSharedProps, labelProps} from './Label.js'
import {Popover} from './Popover.js'

const styles = styler(css)

export interface DateRangePickerProps<T extends DateValue>
  extends AriaDateRangePickerProps<T>, LabelSharedProps {}

export function DateRangePicker<T extends DateValue>({
  className,
  ...props
}: DateRangePickerProps<T>) {
  return (
    <DateRangePickerPrimitive {...props}>
      <Label {...labelProps(props)}>
        <Group
          className={styles.DateRangePicker(
            styler.merge({
              className: typeof className === 'string' ? className : undefined
            })
          )}
        >
          <div className={styles.DateRangePicker.inputs()}>
            <DateInput slot="start" className={styles.DateRangePicker.input()}>
              {segment => (
                <DateSegment
                  segment={segment}
                  className={styles.DateRangePicker.input.segment()}
                />
              )}
            </DateInput>
            <span
              aria-hidden="true"
              className={styles.DateRangePicker.separator()}
            >
              –
            </span>
            <DateInput slot="end" className={styles.DateRangePicker.input()}>
              {segment => (
                <DateSegment
                  segment={segment}
                  className={styles.DateRangePicker.input.segment()}
                />
              )}
            </DateInput>
          </div>
          <Button className={styles.DateRangePicker.trigger()}>
            <Icon icon={IcRoundCalendarMonth} />
          </Button>
        </Group>
      </Label>
      <Popover>
        <Dialog className={styles.DateRangePicker.dialog()}>
          <RangeCalendar />
        </Dialog>
      </Popover>
    </DateRangePickerPrimitive>
  )
}
