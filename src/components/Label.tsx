import styler from '@alinea/styler'
import {
  Label as LabelPrimitive,
  type LabelProps as LabelPrimitiveProps
} from 'react-aria-components'
import type {ReactNode} from 'react'
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
}

export interface LabelProps extends LabelSharedProps, LabelPrimitiveProps {}

export function Label({
  label,
  description,
  errorMessage,
  isRequired,
  icon,
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
  icon
}: T): LabelProps {
  return {
    label,
    description,
    errorMessage,
    isRequired,
    icon
  }
}
