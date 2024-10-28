import {FieldOptions, WithoutLabel} from 'alinea/core'
import {ScalarField} from 'alinea/core/field/ScalarField'
import {ReactNode} from 'react'

export interface CodeFieldOptions extends FieldOptions<string> {
  width?: number
  help?: ReactNode
  inline?: boolean
  language?: string
}

export class CodeField extends ScalarField<string, CodeFieldOptions> {}

export function code(
  label: string,
  options: WithoutLabel<CodeFieldOptions> = {}
): CodeField {
  return new CodeField({
    options: {label, ...options},
    view: 'alinea/field/code/CodeField.view#CodeInput'
  })
}
