import {FieldOptions, Hint, WithoutLabel} from 'alinea/core'
import {ScalarField} from 'alinea/core/field/ScalarField'

export interface NumberOptions extends FieldOptions<number | null> {
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: string
  /** Display a minimal version */
  inline?: boolean
  /** A minimum value */
  minValue?: number
  /** A maximum value */
  maxValue?: number
  /** Specifies the legal number intervals */
  step?: number
}

export class NumberField extends ScalarField<number | null, NumberOptions> {}

export function number(
  label: string,
  options: WithoutLabel<NumberOptions> = {}
): NumberField {
  return new NumberField({
    hint: Hint.Number(),
    options: {label, ...options}
  })
}
