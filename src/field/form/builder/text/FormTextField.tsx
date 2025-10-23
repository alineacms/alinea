import type {RJSFSchema, UiSchema} from '@rjsf/utils'
import type {Infer} from 'alinea/core/Infer'
import {type} from 'alinea/core/Type'
import {number} from 'alinea/field/number'
import {path} from 'alinea/field/path'
import {text} from 'alinea/field/text/TextField'

export const FormTextField = type('Text', {
  fields: {
    title: text('Label', {required: true, width: 0.5}),
    key: path('Key', {required: true, width: 0.5}),
    placeholer: text('Placeholder'),
    defaultValue: text('Default value'),
    maxLength: number('Max Length')
  }
})

export function addTextFieldToRJSF(
  schema: RJSFSchema,
  ui: RJSFSchema,
  row: Infer.ListItem<typeof FormTextField>
) {
  const key = row.key || row._id
  schema.properties![key] = {
    type: 'string',
    title: row.title || '[No label]',
    default: row.defaultValue
  }
  ui[key] = {
    'ui:placeholder': row.placeholer || '',
    'ui:maxLength': row.maxLength ? Number(row.maxLength) : undefined
  }
}
