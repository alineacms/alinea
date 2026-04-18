import type {FieldOptions, WithoutLabel} from '#/core.js'
import {ScalarField} from '#/core/field/ScalarField.js'
import {viewKeys} from '#/dashboard/ViewKeys.js'
import type {ReactNode} from 'react'

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
    view: viewKeys.CodeInput
  })
}
