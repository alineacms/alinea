import {Field, Label} from '@alinea/core'

export type TextOptions = {
  help?: Label
  multiline?: boolean
  inline?: boolean
  initialValue?: string
}

export type TextField = Field<string> & {label: Label; options: TextOptions}

export function createText(label: Label, options: TextOptions = {}): TextField {
  return {
    label,
    options
  }
}
