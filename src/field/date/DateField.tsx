import {FieldOptions, Hint, WithoutLabel} from 'alinea/core'
import {ScalarField} from 'alinea/core/field/ScalarField'

/** Optional settings to configure a text field */
export interface DateOptions extends FieldOptions<string> {
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: string
  /** Display a minimal version */
  inline?: boolean
  /** Focus this input automatically */
  autoFocus?: boolean
}

/** Internal representation of a date field */
export class DateField extends ScalarField<string, DateOptions> {}

/** Create a date field configuration */
export function date(
  label: string,
  options: WithoutLabel<DateOptions> = {}
): DateField {
  return new DateField({
    hint: Hint.String(),
    options: {label, ...options}
  })
}
