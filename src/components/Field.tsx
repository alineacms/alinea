import styler from '@alinea/styler'
import type {ReactNode} from 'react'
import {Label as LabelPrimitive, Text} from 'react-aria-components'
import {Badge} from './Badge.js'
import {IcRoundPublic} from '#/dashboard/icons.js'
import css from './Field.module.css'
import {Icon} from './Icon.js'
import type {FieldSharedProps, StyleProps} from './types.js'

const styles = styler(css)

export interface FieldProps extends FieldSharedProps, StyleProps {
  /** Id of the control the label describes, not needed inside our inputs */
  htmlFor?: string
  children?: ReactNode
}

/**
 * Renders the label, description and error around a form control. All
 * inputs in this library render a Field, use it directly to give a custom
 * control the same chrome.
 */
export function Field({
  label,
  description,
  error,
  required,
  disabled,
  icon,
  shared,
  htmlFor,
  className,
  style,
  children
}: FieldProps) {
  const hasHeader = label || icon || description || shared
  if (!hasHeader && !error && !children) return null
  return (
    <div
      data-slot="field"
      // Lets the dashboard find the first invalid field to focus
      data-invalid={error ? true : undefined}
      className={styles.Field(styler.merge({className}))}
      style={style}
    >
      {hasHeader && (
        <div
          data-slot="field-header"
          className={styles.FieldHeader({disabled})}
        >
          {icon && (
            <Icon
              icon={icon}
              data-slot="field-icon"
              className={styles.FieldHeader.icon()}
            />
          )}
          {label && (
            <FieldLabel htmlFor={htmlFor} required={required}>
              {label}
            </FieldLabel>
          )}
          {description && <FieldDescription>{description}</FieldDescription>}
          {shared && <FieldSharedBadge />}
        </div>
      )}
      {children}
      {error && <FieldError>{error}</FieldError>}
    </div>
  )
}

export interface FieldLabelProps extends StyleProps {
  htmlFor?: string
  required?: boolean
  children: ReactNode
}

export function FieldLabel({
  required,
  className,
  children,
  ...props
}: FieldLabelProps) {
  return (
    <LabelPrimitive
      data-slot="field-label"
      {...props}
      className={styles.FieldLabel(styler.merge({className}))}
    >
      {children}
      {required && (
        <span
          data-slot="field-required"
          className={styles.FieldLabel.required()}
        >
          {' *'}
        </span>
      )}
    </LabelPrimitive>
  )
}

export interface FieldDescriptionProps extends StyleProps {
  children: ReactNode
}

/** Inside a react-aria field its id is added to the control's aria-describedby */
export function FieldDescription({className, ...props}: FieldDescriptionProps) {
  return (
    <Text
      slot="description"
      elementType="div"
      data-slot="field-description"
      {...props}
      className={styles.FieldDescription(styler.merge({className}))}
    />
  )
}

export interface FieldErrorProps extends StyleProps {
  children: ReactNode
}

/** Inside a react-aria field its id is added to the control's aria-describedby */
export function FieldError({className, ...props}: FieldErrorProps) {
  return (
    <Text
      slot="errorMessage"
      elementType="div"
      data-slot="field-error"
      role="alert"
      {...props}
      className={styles.FieldError(styler.merge({className}))}
    />
  )
}

export interface FieldSharedBadgeProps extends StyleProps {
  children?: ReactNode
}

/** Marks a field as shared between translations */
export function FieldSharedBadge({
  children = 'Shared',
  ...props
}: FieldSharedBadgeProps) {
  return (
    <Badge
      data-slot="field-shared-badge"
      icon={IcRoundPublic}
      size="sm"
      title="Shared field"
      {...props}
    >
      {children}
    </Badge>
  )
}
