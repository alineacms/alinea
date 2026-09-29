import styler from '@alinea/styler'
import type {ReactElement, ReactNode} from 'react'
import css from './Alert.module.css'
import {Icon} from './Icon.js'
import type {AriaProps, DataProps, IconType, StyleProps} from './types.js'

const styles = styler(css)

export interface AlertProps extends StyleProps, AriaProps, DataProps {
  variant?: 'default' | 'destructive' | 'warning'
  icon?: IconType | ReactElement
  /**
   * Defaults to `alert` for destructive alerts, which interrupts assistive
   * technology, and `status` for the others
   */
  role?: 'alert' | 'status' | 'note'
  children: ReactNode
}

/** A callout for an important message: AlertTitle, AlertDescription and AlertActions */
export function Alert({
  variant = 'default',
  icon,
  role = variant === 'destructive' ? 'alert' : 'status',
  className,
  children,
  ...props
}: AlertProps) {
  return (
    <div
      data-slot="alert"
      role={role}
      {...props}
      data-variant={variant}
      data-icon={icon ? true : undefined}
      className={styles.Alert(styler.merge({className}))}
    >
      {icon && <Icon icon={icon} className={styles.Alert.icon()} />}
      {children}
    </div>
  )
}

export interface AlertTitleProps extends StyleProps, DataProps {
  id?: string
  children: ReactNode
}

export function AlertTitle({className, ...props}: AlertTitleProps) {
  return (
    <div
      data-slot="alert-title"
      {...props}
      className={styles.AlertTitle(styler.merge({className}))}
    />
  )
}

export interface AlertDescriptionProps extends StyleProps, DataProps {
  id?: string
  children: ReactNode
}

export function AlertDescription({className, ...props}: AlertDescriptionProps) {
  return (
    <div
      data-slot="alert-description"
      {...props}
      className={styles.AlertDescription(styler.merge({className}))}
    />
  )
}

export interface AlertActionsProps extends StyleProps, DataProps {
  children: ReactNode
}

/** Controls below the description */
export function AlertActions({className, ...props}: AlertActionsProps) {
  return (
    <div
      data-slot="alert-actions"
      {...props}
      className={styles.AlertActions(styler.merge({className}))}
    />
  )
}
