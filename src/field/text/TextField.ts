import type {FieldOptions, WithoutLabel} from 'alinea/core/Field'
import {ScalarField} from 'alinea/core/field/ScalarField'
import {viewKeys} from 'alinea/dashboard/editor/ViewKeys'
import type {ComponentType, ReactNode} from 'react'

/** Optional settings to configure a text field */
export interface TextOptions extends FieldOptions<string> {
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: ReactNode
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
  /** Index the text value of this field */
  searchable?: boolean
  /** Short hint that describes the expected value */
  placeholder?: string
  /** Determines which data the field accepts */
  type?: 'email' | 'tel' | 'text' | 'url'
}

export class TextField extends ScalarField<string, TextOptions> {}

/** Create a text field */
export function text(label: string, options: WithoutLabel<TextOptions> = {}) {
  return new TextField({
    options: {label, ...options, initialValue: options.initialValue ?? ''},
    view: viewKeys.TextInput
  })
}
