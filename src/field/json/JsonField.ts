import {FieldOptions, WithoutLabel} from 'alinea/core'
import {ScalarField} from 'alinea/core/field/ScalarField'
import {ReactNode} from 'react'

/** Optional settings to configure a JSON field */
export interface JsonOptions<T> extends FieldOptions<T> {
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: ReactNode
  /** Display a minimal version */
  inline?: boolean
  /** Focus this input automatically */
  autoFocus?: boolean
}

/** Internal representation of a text field */
export class JsonField<T> extends ScalarField<T, JsonOptions<T>> {}

/** Create a text field configuration */
export function json<T>(
  label: string,
  options: WithoutLabel<JsonOptions<T>> = {}
): JsonField<T> {
  return new JsonField({
    options: {label, ...options},
    view: 'alinea/field/json/JsonField.view#JsonInput'
  })
}
