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
  /** `primary` tints the badge with the accent color, eg. to name a type */
  color?: 'default' | 'primary'
  /** Colors the badge like the matching entry status */
  status?: ContentStatus
  title?: string
  children?: ReactNode
}

export function Badge({
  icon,
  size = 'default',
  color,
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
      data-color={color}
      data-status={status}
      className={styles.Badge(styler.merge({className}))}
    >
      {icon && (
        <Icon
          icon={icon}
          data-slot="badge-icon"
          className={styles.Badge.icon()}
        />
      )}
      <span data-slot="badge-label" className={styles.Badge.label()}>
        {children}
      </span>
    </span>
  )
}
