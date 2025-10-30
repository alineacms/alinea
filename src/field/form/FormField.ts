import type {RJSFSchema, UiSchema} from '@rjsf/utils'
import type {FieldOptions, WithoutLabel} from 'alinea/core'
import {ScalarField} from 'alinea/core/field/ScalarField'
import {viewKeys} from 'alinea/dashboard/editor/ViewKeys'
import type {ReactNode} from 'react'

export type FormDefinition = {
  schema: RJSFSchema
  ui: any
}

/** Optional settings to configure a text field */
export interface FormOptions extends FieldOptions<FormDefinition> {
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: ReactNode
  /** Display a minimal version */
  initialValue?: FormDefinition
}

/** Internal representation of a date field */
export class FormField extends ScalarField<FormDefinition, FormOptions> {}

/** Create a date field configuration */
export function form(
  label: string,
  options: WithoutLabel<FormOptions> = {}
): FormField {
  return new FormField({
    options: {label, ...options},
    view: viewKeys.FormInput
  })
}
