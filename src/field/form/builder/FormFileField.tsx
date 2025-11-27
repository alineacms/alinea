import type {Infer} from 'alinea/core/Infer'
import {type} from 'alinea/core/Type'
import {path} from 'alinea/field/path'
import {text} from 'alinea/field/text/TextField'
import { JSONSchema7, JSONSchema7Definition } from 'json-schema';
import { FormDefinition } from '../FormField.js'

export const FormFileField = type('File', {
  fields: {
    title: text('Label', {required: true, width: 0.5}),
    key: path('Key', {required: true, width: 0.5}),
    placeholder: text('Placeholder'),
  }
})

export function transformFieldSchemaToFileField(
  key: string,
  field: JSONSchema7,
  schema: FormDefinition['schema'],
  uiSchema: FormDefinition['ui'],
): Infer<typeof FormFileField> | void {
  if(field.type !== 'string') return 
  const uiFieldSchema = uiSchema?.[key] || {}
  if(uiFieldSchema?.['ui:widget'] !== 'file' && field.format !== 'data-url' ) return

  return {
    title: field.title || '[No label]',
    key: key,
    placeholder: uiFieldSchema?.['ui:placeholder'] || '',
  }
}

export function addFileFieldToRJSF(
  schema: FormDefinition['schema'],
  uiSchema: FormDefinition['ui'],
  row: Infer.ListItem<typeof FormFileField>
) {
  const key = row.key || row._id

  const properties: JSONSchema7Definition = {
    type: 'string',
    title: row.title || '[No label]',
    format: 'data-url'
  }
  schema.properties![key] = properties
  
  const ui: any = {}
  ui['ui:widget'] = 'file'

  if(Object.keys(ui).length > 0) {
    uiSchema[key] = ui
  }
}
