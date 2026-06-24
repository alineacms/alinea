import styler from '@alinea/styler'
import type {ComponentPropsWithoutRef, ReactNode} from 'react'
import {
  Label as LabelPrimitive,
  type LabelProps as LabelPrimitiveProps
} from 'react-aria-components'
import {Badge} from '../dashboard/app/Badge.js'
import {IcRoundPublic} from '../dashboard/icons.js'
import css from './Label.module.css'

const styles = styler(css)

export interface LabelSharedProps {
  label?: ReactNode
  asLabel?: boolean
  description?: ReactNode
  errorMessage?: ReactNode
  isRequired?: boolean
  isDisabled?: boolean
  icon?: ReactNode
  id?: string
  shared?: boolean
}

export interface LabelProps extends LabelSharedProps, LabelPrimitiveProps {}

export function LabelHeader({
  label,
  description,
  shared,
  icon,
  isRequired,
  asLabel,
  ...props
}: LabelProps) {
  const hasLabel = label || isRequired
  const hasTitle = hasLabel || icon
  return (
    <header className={styles.LabelHeader()}>
      {hasTitle && (
        <LabelTitle
          asLabel={asLabel}
          label={label}
          description={description}
          shared={shared}
          icon={icon}
          isRequired={isRequired}
          {...props}
        />
      )}
    </header>
  )
}

export function LabelTitle({
  description,
  shared,
  icon,
  label,
  isRequired,
  asLabel,
  ...props
}: LabelProps) {
  return (
    <div className={styles.LabelTitle()}>
      {icon && <LabelIcon icon={icon} />}
      {(label || isRequired) && (
        <LabelLabel
          {...props}
          asLabel={asLabel}
          label={label}
          isRequired={isRequired}
        />
      )}
      {description && <LabelDescription description={description} />}
      {shared && <SharedLabelBadge />}
    </div>
  )
}

export interface LabelLabelProps extends LabelPrimitiveProps {
  label?: ReactNode
  isRequired?: boolean
  asLabel?: boolean
  tone?: 'muted' | 'inherit'
  weight?: 'normal' | 'semibold'
}

export function LabelLabel({
  children,
  label,
  isRequired,
  asLabel,
  tone,
  weight,
  ...props
}: LabelLabelProps) {
  const Element = (
    asLabel === false ? 'div' : LabelPrimitive
  ) as React.ElementType
  const {className, ...rest} = props
  return (
    <Element
      {...rest}
      className={styles.LabelLabel(styler.merge({className}))}
      data-tone={tone}
      data-weight={weight}
    >
      {label ?? children}
      {isRequired && <span className={styles.LabelRequired()}> *</span>}
    </Element>
  )
}

export function LabelIcon({icon}: {icon: ReactNode}) {
  return <span className={styles.LabelIcon()}>{icon}</span>
}

export interface LabelDescriptionProps extends ComponentPropsWithoutRef<'div'> {
  description?: ReactNode
  size?: 'base' | 'small'
}

export function LabelDescription({
  children,
  className,
  description,
  size,
  ...props
}: LabelDescriptionProps) {
  return (
    <div
      {...props}
      className={styles.LabelDescription(styler.merge({className}))}
      data-size={size}
    >
      {description ?? children}
    </div>
  )
}

export interface LabelStackProps extends ComponentPropsWithoutRef<'span'> {}

export function LabelStack({className, ...props}: LabelStackProps) {
  return (
    <span {...props} className={styles.LabelStack(styler.merge({className}))} />
  )
}

export interface LabelInlineProps extends ComponentPropsWithoutRef<'span'> {}

export function LabelInline({className, ...props}: LabelInlineProps) {
  return (
    <span
      {...props}
      className={styles.LabelInline(styler.merge({className}))}
    />
  )
}

export function LabelError({errorMessage}: {errorMessage: ReactNode}) {
  return <div className={styles.LabelError()}>{errorMessage}</div>
}

export interface SharedLabelBadgeProps {
  label?: string
}

export function SharedLabelBadge({label = 'Shared'}: SharedLabelBadgeProps) {
  return (
    <Badge icon={IcRoundPublic} size="small" title="Shared field">
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
  asLabel,
  ...props
}: LabelProps) {
  const hasLabel = label || isRequired
  const hasTitle = hasLabel || icon
  const hasHeader = hasTitle || description
  if (!hasHeader && !errorMessage && !children) return null

  return (
    <div className={styles.Label(styler.merge({className}))}>
      {hasHeader && (
        <LabelHeader
          label={label}
          asLabel={asLabel}
          description={description}
          isRequired={isRequired}
          icon={icon}
          shared={shared}
          {...props}
        />
      )}
      {children}
      {errorMessage && <LabelError errorMessage={errorMessage} />}
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
