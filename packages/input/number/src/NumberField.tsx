import {Field, Label, Shape} from '@alinea/core'

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
    shape: Shape.Scalar(label),
    label,
    options
  }
}
