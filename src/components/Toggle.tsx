import styler from '@alinea/styler'
import {
  ToggleButton as ToggleButtonPrimitive,
  type ToggleButtonGroupProps as ToggleButtonGroupPrimitiveProps,
  ToggleButtonGroup as ToggleButtonGroupPrimitive,
  type ToggleButtonProps as ToggleButtonPrimitiveProps
} from 'react-aria-components'
import css from './Toggle.module.css'

const styles = styler(css)

export interface ToggleButtonGroupProps extends ToggleButtonGroupPrimitiveProps {
  variant?: 'enclosed'
}

export function ToggleButtonGroup({
  variant = 'enclosed',
  className,
  ...props
}: ToggleButtonGroupProps) {
  return (
    <ToggleButtonGroupPrimitive
      data-variant={variant}
      {...props}
      className={renderProps =>
        styles.ToggleButtonGroup(
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

export interface ToggleButtonProps extends ToggleButtonPrimitiveProps {}

export function ToggleButton({className, ...props}: ToggleButtonProps) {
  return (
    <ToggleButtonPrimitive
      {...props}
      className={renderProps =>
        styles.ToggleButton(
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
