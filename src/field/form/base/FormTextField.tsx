import type {Infer} from 'alinea/core/Infer'
import {type} from 'alinea/core/Type'
import {number} from 'alinea/field/number'
import {path} from 'alinea/field/path'
import {text} from 'alinea/field/text/TextField'
import type {JSONSchema7, JSONSchema7Definition} from 'json-schema'
import {select} from '../../select.js'
import type {FormDefinition, FormFieldDefinition} from '../FormField.js'
import {
  autoCompleteValues,
  isAutoCompleteValue
} from '../utils/autoCompleteValues.js'

export const Schema = type('Text', {
  fields: {
    title: text('Label', {required: true, width: 0.5}),
    key: path('Key', {required: true, width: 0.5}),
    widget: select('Widget', {
      options: {
        text: 'Text Input',
        textarea: 'Text Area',
        email: 'Email',
        password: 'Password'
      }
    }),
    placeholder: text('Placeholder'),
    autocomplete: select('Autocomplete', {
      options: autoCompleteValues
    }),
    defaultValue: text('Default value'),
    maxLength: number('Max Length')
  }
})

export function rjsfToField(
  key: string,
  schema: FormDefinition['schema'],
  uiSchema: FormDefinition['ui']
): Infer<typeof Schema> | undefined {
  if (schema.type !== 'string') return undefined

  let widget: Infer<typeof Schema>['widget'] = 'text'
  if (uiSchema['ui:widget'] === 'textarea') widget = 'textarea'
  if (uiSchema['ui:widget'] === 'password') widget = 'password'
  if (schema.format === 'email') widget = 'email'

  const autocomplete = uiSchema['ui:autocomplete']
  return {
    title: schema.title || '[No label]',
    key: key,
    widget,
    placeholder: uiSchema['ui:placeholder'] || '',
    autocomplete: isAutoCompleteValue(autocomplete) ? autocomplete : null,
    defaultValue: (schema.default as string) || '',
    maxLength: schema.maxLength || null
  }
}

export function addFieldToRjsf(
  properties: Record<string, JSONSchema7>,
  uiSchema: FormDefinition['ui'],
  field: Infer.ListItem<typeof Schema>
) {
  const key = field.key || field._id
  console.log(key)

  const schema: JSONSchema7Definition = {
    type: 'string',
    title: field.title || '[No label]'
  }
  properties[key] = schema
  if (field.maxLength) schema.maxLength = field.maxLength
  if (field.defaultValue) schema.default = field.defaultValue

  const ui: any = {}
  if (field.autocomplete) ui['ui:autocomplete'] = field.autocomplete
  if (field.placeholder) ui['ui:placeholder'] = field.placeholder
  if (field.widget === 'textarea') ui['ui:widget'] = 'textarea'
  if (field.widget === 'email') schema.format = 'email'
  if (field.widget === 'password') ui['ui:widget'] = 'password'

  if (Object.keys(ui).length > 0) {
    uiSchema[key] = ui
  }
}

export const FormTextField = {
  schema: Schema,
  rjsfToField,
  addFieldToRjsf
} satisfies FormFieldDefinition<typeof Schema>
