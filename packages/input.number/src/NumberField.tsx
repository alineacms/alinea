import {Field, Label, Shape} from '@alinea/core'

export type NumberOptions = {
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
  /** Hide this number field */
  hidden?: boolean
}

export interface NumberField extends Field.Scalar<number> {
  label: Label
  options: NumberOptions
}

export function createNumber(
  label: Label,
  options: NumberOptions = {}
): NumberField {
  return {
    shape: Shape.Scalar(label, options.initialValue),
    label,
    options,
    hidden: options.hidden
  }
}
