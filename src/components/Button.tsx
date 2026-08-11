import styler from '@alinea/styler'
import type {ComponentType, ReactNode} from 'react'
import {
  Button as ButtonPrimitive,
  type ButtonProps as ButtonPrimitiveProps
} from 'react-aria-components'
import css from './Button.module.css'
import {Icon} from './Icon.js'
import {ProgressCircle} from './ProgressCircle.js'

const styles = styler(css)

export interface ButtonProps extends ButtonPrimitiveProps {
  appearance?: 'solid' | 'outline' | 'plain' | 'active'
  intent?: 'primary' | 'secondary' | 'danger' | 'warning'
  size?: 'small' | 'medium' | 'large' | 'icon' | 'icon-small' | 'icon-nav'
  icon?: ComponentType
  children?: ReactNode
}

export function Button({
  appearance,
  intent,
  size,
  icon,
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-appearance={appearance}
      data-intent={intent}
      data-size={size}
      {...props}
      className={renderProps =>
        styles.Button(
          styler.merge({
            className:
              typeof className === 'function'
                ? className(renderProps)
                : className
          })
        )
      }
    >
      {props.isPending ? (
        <ProgressCircle isIndeterminate aria-label="Pending..." />
      ) : (
        icon && <Icon icon={icon} data-slot="icon" />
      )}
      {children}
    </ButtonPrimitive>
  )
}
