import styler from '@alinea/styler'
import type {PropsWithChildren} from 'react'
import {
  RadioGroup as AriaRadioGroup,
  type RadioGroupProps as AriaRadioGroupProps,
  Radio as RadioPrimitive,
  type RadioProps
} from 'react-aria-components'
import {Label, type LabelSharedProps, labelProps} from './Label.js'
import css from './RadioGroup.module.css'

const styles = styler(css)

export type {RadioProps} from 'react-aria-components'

export function Radio(props: RadioProps) {
  const {className, ...rest} = props
  return (
    <RadioPrimitive
      {...rest}
      className={renderProps =>
        styles.Radio(
          styler.merge({
            className:
              typeof className === 'function'
                ? className(renderProps)
                : className
          })
        )
      }
    />
  )
}

export interface RadioGroupProps
  extends Omit<AriaRadioGroupProps, 'children'>, LabelSharedProps {}

export function RadioGroup({
  children,
  className,
  ...props
}: PropsWithChildren<RadioGroupProps>) {
  return (
    <AriaRadioGroup {...props}>
      <Label {...labelProps(props)}>
        <div
          className={styles.RadioGroup(
            styler.merge({
              className: typeof className === 'string' ? className : undefined
            })
          )}
        >
          {children}
        </div>
      </Label>
    </AriaRadioGroup>
  )
}
