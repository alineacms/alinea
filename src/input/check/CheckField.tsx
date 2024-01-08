import {FieldOptions, Hint, Label, WithoutLabel} from 'alinea/core'
import {ScalarField} from 'alinea/core/field/ScalarField'

/** Optional settings to configure a text field */
export interface CheckOptions extends FieldOptions<boolean> {
  /** Description displayed next to the checkbox */
  description?: Label
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: string
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
export class CheckField extends ScalarField<boolean, CheckOptions> {}

/** Create a text field configuration */
export function check(
  label: string,
  options: WithoutLabel<CheckOptions> = {}
): CheckField {
  return new CheckField({
    hint: Hint.Boolean(),
    options: {...options, label}
  })
}
