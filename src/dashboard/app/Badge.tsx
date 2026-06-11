import {styler} from '@alinea/styler'
import {
  type ComponentPropsWithoutRef,
  type ComponentType,
  type ReactElement
} from 'react'
import {Icon} from '../../components/Icon.js'
import css from './Badge.module.css'

const styles = styler(css)

interface BadgeProps extends ComponentPropsWithoutRef<'span'> {
  icon?: ComponentType | ReactElement
  appearance?: 'background' | 'outline' | 'plain' | 'default'
  size?: 'default' | 'small'
  status?: 'success' | 'warning' | 'neutral' | 'danger' | 'accent'
}

export function Badge({
  children,
  icon,
  size = 'default',
  status = 'neutral',
  appearance = 'default',
  ...props
}: BadgeProps) {
  return (
    <span
      data-status={status}
      data-appearance={appearance}
      data-size={size}
      className={styles.Badge(styler.merge(props))}
    >
      {icon && <Icon icon={icon} />}
      <span className={styles.Badge.label()}>{children}</span>
    </span>
  )
}
