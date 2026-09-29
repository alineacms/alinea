import type {FieldOptions, WithoutLabel} from '#/core.js'
import {ScalarField} from '#/core/field/ScalarField.js'
import {viewKeys} from '#/dashboard/ViewKeys.js'
import type {ReactNode} from 'react'

export interface CodeFieldOptions extends FieldOptions<string> {
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: ReactNode
  /** Display a minimal version */
  inline?: boolean
  /**
   * Language of the code, eg. `ts`, `css` or `html`. The dashboard highlights
   * code with a language agnostic tokenizer and exposes the language as a
   * `data-language` attribute on the editor. Use `text` (or `plaintext`) to
   * turn highlighting off.
   */
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
