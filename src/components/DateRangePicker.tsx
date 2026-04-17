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
import {RangeCalendar} from './Calendar.tsx'
import {IcRoundCalendarMonth} from '../stories/icons/IcRoundCalendarMonth.tsx'
import {Icon} from './Icon.tsx'
import {Label, type LabelSharedProps, labelProps} from './Label.tsx'
import {Popover} from './Popover.tsx'
import css from './DateRangePicker.module.css'

const styles = styler(css)

export interface DateRangePickerProps<T extends DateValue>
  extends AriaDateRangePickerProps<T>,
    LabelSharedProps {}

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
            <DateInput
              slot="start"
              className={styles.DateRangePicker.input()}
            >
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
