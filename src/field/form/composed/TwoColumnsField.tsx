import type {Infer} from 'alinea/core/Infer'
import type {Schema} from 'alinea/core/Schema.js'
import {type} from 'alinea/core/Type'
import {generateKeyBetween} from 'alinea/core/util/FractionalIndexing'
import {path} from 'alinea/field/path'
import {text} from 'alinea/field/text/TextField'
import type {JSONSchema7, JSONSchema7Definition} from 'json-schema'
import {list} from '../../list.js'
import type {ComposedFormFieldDefinition, FormDefinition} from '../FormField.js'
import type {RjsfHandler} from '../RjsfHandler.js'

type SchemaType = ReturnType<typeof generateSchema>

function generateSchema(baseSchema: Schema) {
  return type('Array', {
    fields: {
      title: text('Label', {required: true, width: 0.5}),
      key: path('Key', {required: true, width: 0.5}),
      items: list('Fields', {schema: baseSchema})
    }
  })
}

export function rjsfToField(
  key: string,
  schema: FormDefinition['schema'],
  uiSchema: FormDefinition['ui'],
  handler: RjsfHandler
): Infer<SchemaType> | undefined {
  if (schema.type !== 'array') return undefined
  if (!schema.items || schema.items === true) return undefined
  if (Array.isArray(schema.items)) return undefined
  if (schema.items.type !== 'object') return undefined
  if (!schema.items.properties) return undefined

  const properties = schema.items.properties
  const children: Infer.ListItem<any>[] = []
  for (const entry of Object.entries(properties)) {
    const [childKey, childSchema] = entry
    const childUiSchema = uiSchema?.[key] || {}
    if (!childSchema || childSchema === true) continue

    const previousChild = children[children.length - 1]
    const _index = generateKeyBetween(previousChild?._index || null, null)

    const child = handler.rjsfToField(childKey, childSchema, childUiSchema)
    if (child) {
      children.push({...child, _index})
    }
  }

  return {
    title: schema.title || '[No label]',
    key: key,
    items: children
  }
}

export function addFieldToRjsf(
  properties: Record<string, JSONSchema7>,
  uiSchema: FormDefinition['ui'],
  field: Infer.ListItem<SchemaType>,
  handler: RjsfHandler
) {
  const key = field.key || field._id
  const childProperties: Record<string, JSONSchema7> = {}
  const childUiSchema: Record<string, any> = {}
  const schema: JSONSchema7Definition = {
    type: 'array',
    title: field.title || '[No label]',
    items: {
      type: 'object',
      properties: childProperties
    }
  }
  properties[key] = schema

  for (const child of field.items) {
    handler.addFieldToRjsf(childProperties, childUiSchema, child)
  }

  const ui: any = {}
  ui[key] = {...childUiSchema}

  if (Object.keys(ui).length > 0) {
    uiSchema[key] = ui
  }
}

export const TwoColumnsField = {
  generateSchema,
  rjsfToField,
  addFieldToRjsf
} satisfies ComposedFormFieldDefinition<SchemaType>
