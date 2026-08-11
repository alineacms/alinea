import styler from '@alinea/styler'
import {
  DateField as DateFieldPrimitive,
  type DateFieldProps as DateFieldPrimitiveProps,
  DateInput,
  DateSegment,
  type DateValue,
  Group
} from 'react-aria-components'

import css from './DateField.module.css'
import {Label, type LabelSharedProps, labelProps} from './Label.js'

const styles = styler(css)

export interface DateFieldProps<T extends DateValue>
  extends Omit<DateFieldPrimitiveProps<T>, 'children'>, LabelSharedProps {}

export function DateField<T extends DateValue>(props: DateFieldProps<T>) {
  return (
    <DateFieldPrimitive {...props}>
      <Label {...labelProps(props)}>
        <Group
          className={styles.DateField(
            styler.merge({
              className:
                typeof props.className === 'string'
                  ? props.className
                  : undefined
            })
          )}
        >
          <DateInput
            className={styles.DateField.input()}
            aria-invalid={!!props.errorMessage}
          >
            {segment => (
              <DateSegment
                className={styles.DateField.input.segment()}
                segment={segment}
              />
            )}
          </DateInput>
        </Group>
      </Label>
    </DateFieldPrimitive>
  )
}
