import styler from '@alinea/styler'
import {
  Button,
  Input,
  NumberField as NumberFieldPrimitive,
  type NumberFieldProps as NumberFieldPrimitiveProps,
  Group
} from 'react-aria-components'
import {IcRoundKeyboardArrowDown} from '../stories/icons/IcRoundKeyboardArrowDown.tsx'
import {IcRoundKeyboardArrowUp} from '../stories/icons/IcRoundKeyboardArrowUp.tsx'
import {Label, type LabelSharedProps, labelProps} from './Label.tsx'
import css from './NumberField.module.css'

const styles = styler(css)

export interface NumberFieldProps
  extends Omit<NumberFieldPrimitiveProps, 'children'>,
    LabelSharedProps {
  steppers?: boolean
}

export function NumberField({steppers = true, ...props}: NumberFieldProps) {
  return (
    <NumberFieldPrimitive
      {...props}
      className={styles.NumberField()}
      data-invalid={props.errorMessage ? true : undefined}
    >
      <Label {...labelProps(props)}>
        <Group
          className={styles.NumberField.wrapper(
            styler.merge({
              className:
                typeof props.className === 'string' ? props.className : undefined
            })
          )}
          data-invalid={props.errorMessage ? true : undefined}
          data-steppers={steppers}
        >
          <Input className={styles.NumberField.input()} />
          {steppers && (
            <div className={styles.NumberField.buttons()}>
              <Button
                className={styles.NumberField.button()}
                data-slot="increment"
                slot="increment"
              >
                <IcRoundKeyboardArrowUp />
              </Button>
              <Button
                className={styles.NumberField.button()}
                data-slot="decrement"
                slot="decrement"
              >
                <IcRoundKeyboardArrowDown />
              </Button>
            </div>
          )}
        </Group>
      </Label>
    </NumberFieldPrimitive>
  )
}
