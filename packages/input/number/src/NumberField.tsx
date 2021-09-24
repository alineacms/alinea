import {Field, Label} from '@alinea/core'

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
    label,
    options
  }
}
