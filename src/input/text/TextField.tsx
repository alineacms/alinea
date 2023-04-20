import {Field, FieldOptions, Hint, Label} from 'alinea/core'
import type {ComponentType} from 'react'

/** Optional settings to configure a text field */
export interface TextOptions extends FieldOptions {
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: Label
  /** Field is optional */
  optional?: boolean
  /** Allow line breaks */
  multiline?: boolean
  /** Display a minimal version */
  inline?: boolean
  /** An icon (React component) to display on the left side of the input */
  iconLeft?: ComponentType
  /** An icon (React component) to display on the right side of the input */
  iconRight?: ComponentType
  /** Focus this input automatically */
  autoFocus?: boolean
}

export class TextField extends Field.Scalar<string, TextOptions> {}

/** Create a text field */
export function text(label: Label, options: TextOptions = {}) {
  return new TextField({
    hint: Hint.String(),
    label,
    options
  })
}
