import {FieldOptions, Hint, Label} from 'alinea/core'
import {ScalarField} from 'alinea/core/field/ScalarField'

export interface CodeFieldOptions extends FieldOptions {
  width?: number
  help?: Label
  optional?: boolean
  inline?: boolean
  initialValue?: string
  language?: string
}

export class CodeField extends ScalarField<string, CodeFieldOptions> {}

export function code(label: Label, options: CodeFieldOptions = {}): CodeField {
  return new CodeField({
    hint: Hint.String(),
    label,
    options,
    initialValue: options.initialValue
  })
}
