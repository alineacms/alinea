import type {RJSFSchema} from '@rjsf/utils'
import {createId} from 'alinea/core/Id'
import type {Infer} from 'alinea/core/Infer'
import {type} from 'alinea/core/Type'
import {generateKeyBetween} from 'alinea/core/util/FractionalIndexing'
import {list} from 'alinea/field/list/ListField'
import {path} from 'alinea/field/path'
import {text} from 'alinea/field/text/TextField'
import type {JSONSchema7, JSONSchema7Definition} from 'json-schema'
import {select} from '../../select.js'
import type {FormDefinition, FormFieldDefinition} from '../FormField.js'

const Schema = type('Select', {
  fields: {
    title: text('Label', {required: true, width: 0.5}),
    key: path('Key', {required: true, width: 0.5}),
    placeholder: text('Placeholder'),
    options: list('Fields', {
      schema: {
        Option: type('Option', {
          fields: {
            value: text('Value', {required: true, width: 0.5}),
            label: text('Label', {required: true, width: 0.5})
          }
        })
      }
    }),
    defaultValue: text('Default value'),
    widget: select('Widget', {
      options: {
        radio: 'Radio Buttons',
        select: 'Dropdown'
      }
    })
  }
})

function rjsfToField(
  key: string,
  schema: FormDefinition['schema'],
  uiSchema: FormDefinition['ui']
): Infer<typeof Schema> | undefined {
  if (schema.type !== 'string') return undefined
  if (!schema.oneOf) return undefined

  return {
    title: schema.title || '[No label]',
    key,
    options: schema.oneOf.flatMap((option: any) => {
      const optionId = createId()
      const index = generateKeyBetween(null, null)
      const value = option?.const
      const label = option?.title || key
      if (!key) return []
      return [
        {
          _type: 'Option',
          _id: optionId,
          _index: index,
          value,
          label
        }
      ]
    }),
    placeholder: '',
    defaultValue: '',
    widget: uiSchema['ui:widget'] === 'select' ? 'select' : 'radio'
  }
}

function addFieldToRjsf(
  properties: Record<string, JSONSchema7>,
  uiSchema: Record<string, any>,
  field: Infer.ListItem<typeof Schema>
) {
  const key = field.key || field._id

  const schema: JSONSchema7Definition = {
    type: 'string',
    title: field.title || '[No label]',
    oneOf: field.options.map(option => {
      return {
        const: option.value,
        title: option.label
      }
    })
  }
  properties[key] = schema
  if (field.defaultValue) schema.default = field.defaultValue
  uiSchema[key] = {
    'ui:placeholder': field.placeholder || '',
    'ui:widget': field.widget
  }
}

export const FormSelectField = {
  schema: Schema,
  rjsfToField,
  addFieldToRjsf
} satisfies FormFieldDefinition<typeof Schema>
