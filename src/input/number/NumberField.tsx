import {Field, FieldOptions, Hint, Label} from 'alinea/core'

export interface NumberOptions extends FieldOptions {
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: Label
  /** Field is optional */
  optional?: boolean
  /** Display a minimal version */
  inline?: boolean
  /** A default value */
  initialValue?: number
  /** A minimum value */
  minValue?: number
  /** A maximum value */
  maxValue?: number
  /** Specifies the legal number intervals */
  step?: number
}

export class NumberField extends Field.Scalar<number, NumberOptions> {}

export function number(label: Label, options: NumberOptions = {}): NumberField {
  return new NumberField({
    hint: Hint.Number(),
    label,
    options,
    initialValue: options.initialValue
  })
}
