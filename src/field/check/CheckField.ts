import {FieldOptions, WithoutLabel} from 'alinea/core/Field'
import {ScalarField} from 'alinea/core/field/ScalarField'
import {ReactNode} from 'react'

/** Optional settings to configure a text field */
export interface CheckOptions extends FieldOptions<boolean> {
  /** Description displayed next to the checkbox */
  description?: string
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
export class CheckField extends ScalarField<boolean, CheckOptions> {}

/** Create a text field configuration */
export function check(
  label: string,
  options: WithoutLabel<CheckOptions> = {}
): CheckField {
  return new CheckField({
    options: {...options, label},
    view: 'alinea/field/check/CheckField.view#CheckInput'
  })
}
