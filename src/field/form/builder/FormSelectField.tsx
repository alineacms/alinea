import type {RJSFSchema} from '@rjsf/utils'
import type {Infer} from 'alinea/core/Infer'
import {type} from 'alinea/core/Type'
import {path} from 'alinea/field/path'
import {text} from 'alinea/field/text/TextField'
import {list} from 'alinea/field/list/ListField'
import { select } from '../../select.js'
import { FormDefinition } from '../FormField.js'
import { JSONSchema7 } from 'json-schema';
import { createId } from 'alinea/core/Id'
import {generateKeyBetween} from 'alinea/core/util/FractionalIndexing'

export const FormSelectField = type('Select', {
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

export function transformFieldSchemaToSelectField(
  key: string,
  fieldSchema: JSONSchema7,
  formSchema: FormDefinition['schema'],
  uiSchema: FormDefinition['ui'],
): Infer<typeof FormSelectField> | void {
  if(fieldSchema.type !== 'string') return 
  if(!fieldSchema.oneOf) return

  return {
    title: fieldSchema.title || '[No label]',
    key,
    options: fieldSchema.oneOf.flatMap((option: any) => {
      const optionId = createId()
      const index = generateKeyBetween(null, null)
      const value = option?.const
      const label = option?.title || key
      if(!key) return []
      return [
        {
          _type: 'Option',
          _id: optionId,
          _index: index,
          value,
          label,
        }
      ]
    }),
    placeholder: '',
    defaultValue: '',
    widget: 'radio',
  }
}

export function addSelectFieldToRJSF(
  schema: RJSFSchema,
  ui: RJSFSchema,
  row: Infer.ListItem<typeof FormSelectField>
) {
  const key = row.key || row._id
  schema.properties![key] = {
    type: 'string',
    title: row.title || '[No label]',
    default: row.defaultValue,
    oneOf: row.options.map(option => {
      return {
        'const': option.value,
        'title': option.label
      }
    })
  }
  ui[key] = {
    'ui:placeholder': row.placeholder || '',
    'ui:widget': row.widget
  }

  console.log('Added select field to RJSF:', key, schema.properties![key], ui[key])
}
