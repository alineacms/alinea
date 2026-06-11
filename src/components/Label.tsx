import styler from '@alinea/styler'
import {
  Label as LabelPrimitive,
  type LabelProps as LabelPrimitiveProps
} from 'react-aria-components'
import type {ReactNode} from 'react'
import {Badge} from '../dashboard/app/Badge.js'
import {IcRoundPublic} from '../dashboard/icons.js'
import css from './Label.module.css'

const styles = styler(css)

export interface LabelSharedProps {
  label?: ReactNode
  asLabel?: false
  description?: ReactNode
  errorMessage?: ReactNode
  isRequired?: boolean
  isDisabled?: boolean
  icon?: ReactNode
  id?: string
  shared?: boolean
}

export interface LabelProps extends LabelSharedProps, LabelPrimitiveProps {}

export interface SharedLabelBadgeProps {
  label?: string
}

export function SharedLabelBadge({label = 'Shared'}: SharedLabelBadgeProps) {
  return (
    <Badge
      appearance="background"
      icon={IcRoundPublic}
      size="small"
      status="accent"
      title="Shared field"
    >
      {label}
    </Badge>
  )
}

export function Label({
  label,
  description,
  errorMessage,
  isRequired,
  icon,
  shared,
  children,
  className,
  ...props
}: LabelProps) {
  const hasLabel = label || isRequired
  const hasTitle = hasLabel || icon
  const hasHeader = hasTitle || description

  if (!hasHeader && !errorMessage && !children) return null

  return (
    <div className={styles.Label(styler.merge({className}))}>
      {hasHeader && (
        <header className={styles.Label.header()}>
          {hasTitle && (
            <div className={styles.Label.title()}>
              {icon && <span className={styles.Label.icon()}>{icon}</span>}
              {hasLabel && (
                <LabelPrimitive {...props} className={styles.Label.label()}>
                  {label}
                  {isRequired && (
                    <span className={styles.Label.required()}> *</span>
                  )}
                </LabelPrimitive>
              )}
              {shared && <SharedLabelBadge />}
            </div>
          )}
          {description && (
            <div className={styles.Label.description()}>{description}</div>
          )}
        </header>
      )}
      {children}
      {errorMessage && <div className={styles.Label.error()}>{errorMessage}</div>}
    </div>
  )
}

export function labelProps<T extends LabelSharedProps>({
  label,
  description,
  errorMessage,
  isRequired,
  icon,
  shared
}: T): LabelProps {
  return {
    label,
    description,
    errorMessage,
    isRequired,
    icon,
    shared
  }
}
