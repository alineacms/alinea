import type {FieldOptions, WithoutLabel} from 'alinea/core'
import {ScalarField} from 'alinea/core/field/ScalarField'
import type {Infer} from 'alinea/core/Infer.js'
import type {Schema} from 'alinea/core/Schema.js'
import type {Type} from 'alinea/core/Type.js'
import {viewKeys} from 'alinea/dashboard/editor/ViewKeys'
import type {JSONSchema7} from 'json-schema'
import type {ReactNode} from 'react'
import {FormFileField} from './base/FormFileField.js'
import {FormSelectField} from './base/FormSelectField.js'
import {FormTextField} from './base/FormTextField.js'
import {FormArrayField} from './composed/FormArrayField.js'
import type {RjsfHandler} from './RjsfHandler.js'

export type FormDefinition = {
  schema: JSONSchema7
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
  /** Simple form fields like text input, checkboxes, selects, etc */
  baseFields?: Record<string, FormFieldDefinition<any>>
  /** Composed fields like arrays, objects, etc */
  composedFields?: Record<string, ComposedFormFieldDefinition<any>>
}

export type FormFieldDefinition<K extends Type> = {
  schema: Type<K>
  rjsfToField: (
    key: string,
    schema: FormDefinition['schema'],
    uiSchema: FormDefinition['ui'],
    handler: RjsfHandler
  ) => Infer<K> | undefined
  addFieldToRjsf: (
    properties: Record<string, JSONSchema7>,
    uiSchema: Record<string, any>,
    row: Infer.ListItem<K>,
    handler: RjsfHandler
  ) => void
}

export type ComposedFormFieldDefinition<K extends Type> = {
  generateSchema: (baseFields: Schema) => Type<K>
  rjsfToField: (
    key: string,
    fieldSchema: JSONSchema7,
    schema: FormDefinition['schema'],
    uiSchema: FormDefinition['ui']
  ) => Infer<K> | undefined
  addFieldToRjsf: (
    properties: Record<string, JSONSchema7>,
    uiSchema: Record<string, any>,
    row: Infer.ListItem<K>,
    handler: RjsfHandler
  ) => void
}

/** Internal representation of a date field */
export class FormField extends ScalarField<FormDefinition, FormOptions> {}

/** Create a date field configuration */
export function form(
  label: string,
  options: WithoutLabel<FormOptions> = {}
): FormField {
  const defaultBaseFields = {
    FormFileField,
    FormSelectField,
    FormTextField
  } as unknown as Record<string, FormFieldDefinition<any>> // TODO: fix typing
  const composedBaseFields = {
    FormArrayField
  } as unknown as Record<string, ComposedFormFieldDefinition<any>> // TODO: fix typing
  return new FormField({
    options: {
      label,
      ...options,
      baseFields: options.baseFields || defaultBaseFields,
      composedFields: options.composedFields || composedBaseFields
    },
    view: viewKeys.FormInput
  })
}
