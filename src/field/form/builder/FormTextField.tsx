import type {RJSFSchema, UiSchema} from '@rjsf/utils'
import type {Infer} from 'alinea/core/Infer'
import {type} from 'alinea/core/Type'
import {number} from 'alinea/field/number'
import {path} from 'alinea/field/path'
import {text} from 'alinea/field/text/TextField'
import { JSONSchema7, JSONSchema7Definition } from 'json-schema';
import { FormDefinition } from '../FormField.js'
import { select } from '../../select.js'

export const FormTextField = type('Text', {
  fields: {
    title: text('Label', {required: true, width: 0.5}),
    key: path('Key', {required: true, width: 0.5}),
    widget: select('Widget', {
        options: {
          text: 'Text Input',
          textarea: 'Text Area',
          email: "Email",
          password: 'Password'
        }
    }),
    placeholder: text('Placeholder'),
    defaultValue: text('Default value'),
    maxLength: number('Max Length')
  }
})

export function transformFieldSchemaToTextField(
  key: string,
  field: JSONSchema7,
  schema: FormDefinition['schema'],
  uiSchema: FormDefinition['ui'],
): Infer<typeof FormTextField> | void {
  if(field.type !== 'string') return 
  const uiFieldSchema = uiSchema?.[key] || {}

  let widget: Infer<typeof FormTextField>['widget'] = 'text'
  if(uiFieldSchema?.['ui:widget'] === 'textarea') widget = 'textarea'
  if(uiFieldSchema?.['ui:widget'] === 'password') widget = 'password'
  if(field.format === 'email') widget = 'email'

  return {
    title: field.title || '[No label]',
    key: key,
    widget,
    placeholder: uiFieldSchema?.['ui:placeholder'] || '',
    defaultValue: field.default as string || '',
    maxLength: field.maxLength || null
  }
}

export function addTextFieldToRJSF(
  schema: FormDefinition['schema'],
  uiSchema: FormDefinition['ui'],
  row: Infer.ListItem<typeof FormTextField>
) {
  const key = row.key || row._id

  const properties: JSONSchema7Definition = {
    type: 'string',
    title: row.title || '[No label]',
  }
  schema.properties![key] = properties
  if(row.maxLength) properties.maxLength = row.maxLength
  if(row.defaultValue) properties.default = row.defaultValue

  const ui: any = {}
  if(row.placeholder) ui['ui:placeholder'] = row.placeholder
  if(row.widget === 'textarea') ui['ui:widget'] = 'textarea'
  if(row.widget === 'email') schema.properties![key].format = 'email'
  if(row.widget === 'password') ui['ui:widget'] = 'password'

  if(Object.keys(ui).length > 0) {
    uiSchema[key] = ui
  }
}
