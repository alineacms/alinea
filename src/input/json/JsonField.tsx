import {FieldOptions, Hint, Label} from 'alinea/core'
import {ScalarField} from 'alinea/core/field/ScalarField'

/** Optional settings to configure a JSON field */
export interface JsonOptions<Value> extends FieldOptions {
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: Label
  /** Field is optional */
  optional?: boolean
  /** Display a minimal version */
  inline?: boolean
  /** A default value */
  initialValue?: Value
  /** Focus this input automatically */
  autoFocus?: boolean
}

/** Internal representation of a text field */
export class JsonField<Value> extends ScalarField<Value, JsonOptions<Value>> {}

/** Create a text field configuration */
export function json<T>(
  label: Label,
  options: JsonOptions<T> = {}
): JsonField<T> {
  return new JsonField({
    hint: Hint.String(),
    label,
    options,
    initialValue: options.initialValue
  })
}
