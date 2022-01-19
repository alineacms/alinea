import {Field, Label, Value} from '@alinea/core'

export type SelectItems = {
  [key: string]: Label
}

export type SelectOptions = {
  help?: Label
  optional?: boolean
  multiline?: boolean
  inline?: boolean
  initialValue?: string
}

export interface SelectField extends Field<string | undefined> {
  label: Label
  items: SelectItems
  options: SelectOptions
}

export function createSelect(
  label: Label,
  items: SelectItems,
  options: SelectOptions = {}
): SelectField {
  return {
    type: Value.Scalar,
    label,
    items,
    options
  }
}
