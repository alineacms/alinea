import styler from '@alinea/styler'
import type {HTMLAttributes, ReactNode} from 'react'
import css from './Badge.module.css'

const styles = styler(css)

export interface BadgeProps extends Omit<
  HTMLAttributes<HTMLSpanElement>,
  'className'
> {
  icon?: ReactNode
  size?: 'default' | 'small'
  status?: 'published' | 'draft' | 'unpublished' | 'archived'
}

export function Badge({
  children,
  icon,
  size = 'default',
  status,
  ...props
}: BadgeProps) {
  return (
    <span
      {...props}
      className={styles['alinea-Badge']()}
      data-size={size}
      data-status={status}
    >
      {icon && <span className={styles['alinea-Badge-icon']()}>{icon}</span>}
      <span className={styles['alinea-Badge-label']()}>{children}</span>
    </span>
  )
}
