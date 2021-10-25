import {Field, Label, Type} from '@alinea/core'

export type TextOptions = {
  help?: Label
  optional?: boolean
  multiline?: boolean
  inline?: boolean
  initialValue?: string
}

export interface TextField extends Field<string> {
  label: Label
  options: TextOptions
}

export function createText(label: Label, options: TextOptions = {}): TextField {
  return {
    type: Type.Scalar,
    label,
    options
  }
}
