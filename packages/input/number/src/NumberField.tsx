import {Field, Label, Type} from '@alinea/core'

export type NumberOptions = {
  help?: Label
  inline?: boolean
  initialValue?: number
}

export interface NumberField extends Field<number> {
  label: Label
  options: NumberOptions
}

export function createNumber(
  label: Label,
  options: NumberOptions = {}
): NumberField {
  return {
    type: Type.Scalar,
    label,
    options
  }
}
