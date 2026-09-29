import styler from '@alinea/styler'
import type {ReactElement, ReactNode} from 'react'
import css from './Badge.module.css'
import {Icon} from './Icon.js'
import type {
  AriaProps,
  ContentStatus,
  DataProps,
  IconType,
  StyleProps
} from './types.js'

const styles = styler(css)

export interface BadgeProps extends StyleProps, AriaProps, DataProps {
  icon?: IconType | ReactElement
  size?: 'default' | 'sm'
  /** Colors the badge like the matching entry status */
  status?: ContentStatus
  title?: string
  children?: ReactNode
}

export function Badge({
  icon,
  size = 'default',
  status,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      data-slot="badge"
      {...props}
      data-size={size}
      data-status={status}
      className={styles.Badge(styler.merge({className}))}
    >
      {icon && <Icon icon={icon} className={styles.Badge.icon()} />}
      <span className={styles.Badge.label()}>{children}</span>
    </span>
  )
}
