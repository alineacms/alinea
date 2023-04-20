import {Field, FieldOptions, Hint, Label} from 'alinea/core'

export interface CodeFieldOptions extends FieldOptions {
  width?: number
  help?: Label
  optional?: boolean
  inline?: boolean
  initialValue?: string
  language?: string
}

export class CodeField extends Field.Scalar<string, CodeFieldOptions> {}

export function code(label: Label, options: CodeFieldOptions = {}): CodeField {
  return new CodeField({
    hint: Hint.String(),
    label,
    options,
    initialValue: options.initialValue
  })
}
