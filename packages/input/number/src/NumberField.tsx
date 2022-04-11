import {Field, Label, Value} from '@alinea/core'

export type NumberOptions = {
  help?: Label
  inline?: boolean
  initialValue?: number
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
    type: Value.Scalar,
    label,
    options
  }
}
