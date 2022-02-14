import {Field, Label, Value} from '@alinea/core'

export type CodeFieldOptions = {
  width?: number
  help?: Label
  optional?: boolean
  inline?: boolean
  initialValue?: string
  language?: string
}

export interface CodeField extends Field<string> {
  label: Label
  options: CodeFieldOptions
}

export function createCode(
  label: Label,
  options: CodeFieldOptions = {}
): CodeField {
  return {
    type: Value.Scalar,
    label,
    options
  }
}
