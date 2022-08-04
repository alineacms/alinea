import {Field, Label, Shape} from '@alinea/core'
import type {ComponentType} from 'react'

/** Optional settings to configure a text field */
export type JsonOptions = {
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: Label
  /** Field is optional */
  optional?: boolean
  /** Display a minimal version */
  inline?: boolean
  /** A default value */
  initialValue?: string
  /** An icon (React component) to display on the left side of the input */
  iconLeft?: ComponentType
  /** An icon (React component) to display on the right side of the input */
  iconRight?: ComponentType
  /** Focus this input automatically */
  autoFocus?: boolean
  /** Hide this json field */
  hidden?: boolean
}

/** Internal representation of a text field */
export interface JsonField extends Field.Scalar<any> {
  label: Label
  options: JsonOptions
}

/** Create a text field configuration */
export function createJson(label: Label, options: JsonOptions = {}): JsonField {
  return {
    shape: Shape.Scalar(label, options.initialValue),
    label,
    options,
    hidden: options.hidden
  }
}
