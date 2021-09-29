import {Field, Label, Value} from '@alinea/core'

export type TextOptions = {
  help?: Label
  optional?: boolean
  multiline?: boolean
  inline?: boolean
  initialValue?: string
}

export type TextField = Field<string> & {label: Label; options: TextOptions}

export function createText(label: Label, options: TextOptions = {}): TextField {
  return {
    value: Value.Scalar,
    label,
    options
  }
}
