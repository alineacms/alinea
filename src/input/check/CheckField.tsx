import {Field, FieldOptions, Hint, Label} from 'alinea/core'

/** Optional settings to configure a text field */
export interface CheckOptions extends FieldOptions {
  /** Label displayed next to the checkbox  */
  label?: Label
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: Label
  /** Field is optional */
  optional?: boolean
  /** Display a minimal version */
  inline?: boolean
  /** A default value */
  initialValue?: boolean
  /** Focus this input automatically */
  autoFocus?: boolean
}

/** Internal representation of a text field */
export class CheckField extends Field.Scalar<boolean, CheckOptions> {}

/** Create a text field configuration */
export function check(label: Label, options: CheckOptions = {}): CheckField {
  return new CheckField({
    hint: Hint.Boolean(),
    label,
    options,
    initialValue: options.initialValue ?? false
  })
}
