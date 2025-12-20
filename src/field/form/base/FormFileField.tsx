import type {Infer} from 'alinea/core/Infer'
import {type} from 'alinea/core/Type'
import {path} from 'alinea/field/path'
import {text} from 'alinea/field/text/TextField'
import type {JSONSchema7, JSONSchema7Definition} from 'json-schema'
import type {FormDefinition, FormFieldDefinition} from '../FormField.js'

export const Schema = type('File', {
  fields: {
    title: text('Label', {required: true, width: 0.5}),
    key: path('Key', {required: true, width: 0.5}),
    placeholder: text('Placeholder')
  }
})

export function rjsfToField(
  key: string,
  schema: FormDefinition['schema'],
  uiSchema: FormDefinition['ui']
): Infer<typeof Schema> | undefined {
  if (schema.type !== 'string') return undefined
  if (uiSchema['ui:widget'] !== 'file' && schema.format !== 'data-url')
    return undefined

  return {
    title: schema.title || '[No label]',
    key: key,
    placeholder: uiSchema['ui:placeholder'] || ''
  }
}

export function addFieldToRjsf(
  properties: Record<string, JSONSchema7>,
  uiSchema: FormDefinition['ui'],
  field: Infer.ListItem<typeof Schema>
) {
  const key = field.key || field._id

  const schema: JSONSchema7Definition = {
    type: 'string',
    title: field.title || '[No label]',
    format: 'data-url'
  }
  properties[key] = schema

  const ui: any = {}
  ui['ui:widget'] = 'file'

  if (Object.keys(ui).length > 0) {
    uiSchema[key] = ui
  }
}

export const FormFileField = {
  schema: Schema,
  rjsfToField,
  addFieldToRjsf
} satisfies FormFieldDefinition<typeof Schema>
