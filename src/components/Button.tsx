import styler from '@alinea/styler'
import {
  Button as ButtonPrimitive,
  type ButtonProps as ButtonPrimitiveProps
} from 'react-aria-components'
import type {ComponentType, ReactNode} from 'react'
import {Icon} from './Icon.tsx'
import {ProgressCircle} from './ProgressCircle.tsx'
import css from './Button.module.css'

const styles = styler(css)

export interface ButtonProps extends ButtonPrimitiveProps {
  appearance?: 'solid' | 'outline' | 'plain' | 'active'
  intent?: 'primary' | 'secondary' | 'danger' | 'warning'
  size?: 'small' | 'medium' | 'large' | 'square-petite' | 'icon'
  icon?: ComponentType
  children?: ReactNode
}

export function Button({
  intent = 'primary',
  size = 'medium',
  appearance = 'solid',
  children,
  icon,
  className,
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-intent={intent}
      data-size={size}
      data-appearance={appearance}
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
