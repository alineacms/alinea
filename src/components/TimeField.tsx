import styler from '@alinea/styler'
import {
  DateInput,
  DateSegment,
  TimeField as TimeFieldPrimitive,
  type TimeFieldProps as TimeFieldPrimitiveProps,
  type TimeValue
} from 'react-aria-components'

import {Label, type LabelSharedProps, labelProps} from './Label.tsx'
import css from './TimeField.module.css'

const styles = styler(css)

export interface TimeFieldProps<T extends TimeValue>
  extends TimeFieldPrimitiveProps<T>,
    LabelSharedProps {}

export function TimeField<T extends TimeValue>(props: TimeFieldProps<T>) {
  return (
    <TimeFieldPrimitive {...props}>
      <Label {...labelProps(props)}>
        <div
          className={styles.TimeField(
            styler.merge({
              className:
                typeof props.className === 'string' ? props.className : undefined
            })
          )}
        >
          <DateInput className={styles.TimeField.input()}>
            {segment => (
              <DateSegment
                className={styles.TimeField.segment()}
                segment={segment}
              />
            )}
          </DateInput>
        </div>
      </Label>
    </TimeFieldPrimitive>
  )
}
