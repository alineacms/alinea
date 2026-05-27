import {Icon} from '#/components.js'
import {styler} from '@alinea/styler'
import {
  type ComponentPropsWithoutRef,
  type ComponentType,
  type ReactElement
} from 'react'
import css from './Badge.module.css'

const styles = styler(css)

interface BadgeProps extends ComponentPropsWithoutRef<'span'> {
  icon?: ComponentType | ReactElement
  appearance?: 'background' | 'outline' | 'plain' | 'default'
  status?: 'success' | 'warning' | 'neutral' | 'danger'
}

export function Badge({
  children,
  icon,
  status = 'neutral',
  appearance = 'default',
  ...props
}: BadgeProps) {
  return (
    <span
      data-status={status}
      data-appearance={appearance}
      className={styles.Badge(styler.merge(props))}
    >
      {icon && <Icon icon={icon} />}
      <span>{children}</span>
    </span>
  )
}
