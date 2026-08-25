import styler from '@alinea/styler'
import type {ButtonHTMLAttributes, ReactNode} from 'react'
import css from './Button.module.css'

const styles = styler(css)

export interface ButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'className'
> {
  appearance?: 'solid' | 'outline' | 'plain' | 'active'
  icon?: ReactNode
  intent?: 'neutral' | 'primary' | 'secondary' | 'danger'
  size?: 'small' | 'medium' | 'large' | 'icon' | 'icon-small' | 'icon-nav'
}

export function Button({
  appearance = 'solid',
  children,
  disabled,
  icon,
  intent = 'neutral',
  size = 'medium',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={styles['alinea-Button']()}
      data-appearance={appearance}
      data-disabled={disabled ? '' : undefined}
      data-intent={intent}
      data-size={size}
      disabled={disabled}
      type={type}
    >
      {icon && <span className={styles['alinea-Button-icon']()}>{icon}</span>}
      {children && (
        <span className={styles['alinea-Button-label']()}>{children}</span>
      )}
    </button>
  )
}
