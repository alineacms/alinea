import styler from '@alinea/styler'
import {
  Button,
  DateInput,
  DatePicker as DatePickerPrimitive,
  type DatePickerProps as DatePickerPrimitiveProps,
  DateSegment,
  type DateValue,
  Dialog,
  Group
} from 'react-aria-components'
import {IcRoundDateRange as IcRoundCalendarMonth} from '../v2/icons.js'
import {Calendar} from './Calendar.js'
import css from './DatePicker.module.css'
import {Icon} from './Icon.js'
import {Label, type LabelSharedProps, labelProps} from './Label.js'
import {Popover} from './Popover.js'

const styles = styler(css)

export interface DatePickerProps<T extends DateValue>
  extends DatePickerPrimitiveProps<T>, LabelSharedProps {}

export function DatePicker<T extends DateValue>(props: DatePickerProps<T>) {
  return (
    <DatePickerPrimitive {...props}>
      <Label {...labelProps(props)}>
        <Group
          className={styles.DatePicker(
            styler.merge({
              className:
                typeof props.className === 'string'
                  ? props.className
                  : undefined
            })
          )}
        >
          <DateInput
            className={styles.DatePicker.input()}
            aria-invalid={!!props.errorMessage}
          >
            {segment => (
              <DateSegment
                className={styles.DatePicker.input.segment()}
                segment={segment}
              />
            )}
          </DateInput>
          <Button className={styles.DatePicker.trigger()}>
            <Icon icon={IcRoundCalendarMonth} />
          </Button>
        </Group>
      </Label>
      <Popover>
        <Dialog>
          <Calendar />
        </Dialog>
      </Popover>
    </DatePickerPrimitive>
  )
}
