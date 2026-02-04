import type {Infer} from 'alinea/core/Infer'
import {type} from 'alinea/core/Type'
import {path} from 'alinea/field/path'
import {text} from 'alinea/field/text/TextField'
import type {JSONSchema7, JSONSchema7Definition} from 'json-schema'
import type {
  FormDefinition,
  FormFieldDefinition
} from '../../../../dist/field/form.js'

const Schema = type('Project-specific-field', {
  fields: {
    title: text('Label', {required: true, width: 0.5}),
    key: path('Key', {required: true, width: 0.5})
  }
})

function rjsfToField(
  key: string,
  schema: FormDefinition['schema'],
  uiSchema: FormDefinition['ui']
): Infer<typeof Schema> | undefined {
  if (schema.type !== 'string') return undefined
  const uiFieldSchema = uiSchema[key] || {}
  if (uiFieldSchema?.['ui:widget'] !== 'my-custom-widget') return undefined

  return {
    title: schema.title || '[No label]',
    key: key
  }
}

function addFieldToRjsf(
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
  ui['ui:widget'] = 'my-custom-widget'

  if (Object.keys(ui).length > 0) {
    uiSchema[key] = ui
  }
}

export const MyField = {
  schema: Schema,
  rjsfToField,
  addFieldToRjsf
} satisfies FormFieldDefinition<typeof Schema>
