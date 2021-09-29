import {Field, Label, Value} from '@alinea/core'

export type NumberOptions = {
  help?: Label
  inline?: boolean
  initialValue?: number
}

export type NumberField = Field<number> & {label: Label; options: NumberOptions}

export function createNumber(
  label: Label,
  options: NumberOptions = {}
): NumberField {
  return {
    value: Value.Scalar,
    label,
    options
  }
}
