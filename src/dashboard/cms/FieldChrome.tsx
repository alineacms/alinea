import {Field as FieldFrame} from '#/components/Field.js'
import type {FieldSharedProps, StyleProps} from '#/components/types.js'
import type {Field} from '#/core/Field.js'
import type {ReactNode} from 'react'
import {useFieldError, useFieldOptions} from '../hooks.js'

interface ChromeOptions {
  label?: string
  help?: ReactNode
  required?: boolean
  readOnly?: boolean
  shared?: boolean
}

export interface FieldChromeProps extends FieldSharedProps, StyleProps {
  /** The field whose label, help text, validation error and state to show */
  field: Field
  /** Id of the control the label describes */
  htmlFor?: string
  children?: ReactNode
}

/**
 * Renders the label, help text, shared badge and validation error of a field
 * around a custom control, like the built-in fields. The values come from the
 * field's options and validation state; pass a prop to override one.
 *
 * @example
 * <FieldChrome field={field} htmlFor={id}>
 *   <input id={id} type="range" />
 * </FieldChrome>
 */
export function FieldChrome({field, children, ...props}: FieldChromeProps) {
  const options = useFieldOptions(field) as ChromeOptions
  const error = useFieldError(field)
  return (
    <FieldFrame
      label={options.label}
      description={options.help}
      error={error}
      required={options.required}
      readOnly={options.readOnly}
      shared={options.shared}
      {...props}
    >
      {children}
    </FieldFrame>
  )
}
