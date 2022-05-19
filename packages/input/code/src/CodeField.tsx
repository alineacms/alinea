import {Field, Label, Shape} from '@alinea/core'

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
    shape: Shape.Scalar(label),
    label,
    options
  }
}
