import {createId} from 'alinea/core/Id'
import type {Infer} from 'alinea/core/Infer.js'
import {generateKeyBetween} from 'alinea/core/util/FractionalIndexing'
import type {JSONSchema7} from 'json-schema'
import type {FormDefinition, FormOptions} from './FormField.js'

export class RjsfHandler {
  public constructor(
    public formSchema: FormDefinition['schema'],
    public uiSchema: FormDefinition['ui'],
    public options: FormOptions
  ) {}

  public generateFields(): Infer.ListItem<any>[] {
    const fields: Infer.ListItem<any>[] = []
    for (const key of Object.keys(this.formSchema?.properties || {})) {
      const schema = this.formSchema.properties?.[key]
      if (!schema || schema === true) continue

      const uiSchema = this.uiSchema?.[key] || {}

      const field = this.rjsfToField(key, schema, uiSchema)
      if (field) {
        const previousField = fields[fields.length - 1]
        const _index = generateKeyBetween(previousField?._index || null, null)
        fields.push({...field, _index})
      }
    }

    return fields
  }

  public rjsfToField(
    key: string,
    schema: FormDefinition['schema'],
    uiSchema: FormDefinition['ui']
  ): Infer.ListItem<any> | undefined {
    const _id = createId()
    const _index = generateKeyBetween(null, null)

    for (const entry of Object.entries(this.options.baseFields || {})) {
      const [_type, fieldDef] = entry
      const field = fieldDef.rjsfToField(key, schema, uiSchema, this)
      if (field) return {_id, _index, _type, ...field}
    }
    for (const entry of Object.entries(this.options.composedFields || {})) {
      const [_type, fieldDef] = entry
      const field = fieldDef.rjsfToField(key, schema, uiSchema, this)
      if (field) return {_id, _index, _type, ...field}
    }
    return undefined
  }

  public rebuildSchemas(fields: Infer.ListItem<any>[]): FormDefinition {
    const properties: Record<string, JSONSchema7> = {}
    const newUiSchema: FormDefinition['ui'] = {}

    for (const field of fields) {
      for (const entry of Object.entries(this.options.baseFields || {})) {
        const [key, fieldDef] = entry
        if (field._type === key) {
          fieldDef.addFieldToRjsf(properties, newUiSchema, field, this)
          break
        }
      }
      for (const entry of Object.entries(this.options.composedFields || {})) {
        const [key, fieldDef] = entry
        if (field._type === key) {
          fieldDef.addFieldToRjsf(properties, newUiSchema, field, this)
          break
        }
      }
    }
    return {
      schema: {
        type: 'object',
        properties
      },
      ui: newUiSchema
    }
  }

  public addFieldToRjsf(
    properties: Record<string, JSONSchema7>,
    uiSchema: Record<string, any>,
    field: Infer.ListItem<any>
  ) {
    for (const entry of Object.entries(this.options.baseFields || {})) {
      const [key, fieldDef] = entry
      if (field._type === key) {
        fieldDef.addFieldToRjsf(properties, uiSchema, field, this)
        return
      }
    }
    for (const entry of Object.entries(this.options.composedFields || {})) {
      const [key, fieldDef] = entry
      if (field._type === key) {
        fieldDef.addFieldToRjsf(properties, uiSchema, field, this)
        return
      }
    }
  }
}
