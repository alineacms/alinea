import {Field, Label, Value} from '@alineacms/core'

export type CodeFieldOptions = {
  width?: number
  help?: Label
  optional?: boolean
  inline?: boolean
  initialValue?: string
  language?: string
}

export interface CodeField extends Field.Scalar<string> {
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
