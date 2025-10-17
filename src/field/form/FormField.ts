import type {FieldOptions, WithoutLabel} from 'alinea/core'
import {ScalarField} from 'alinea/core/field/ScalarField'
import {viewKeys} from 'alinea/dashboard/editor/ViewKeys'
import type {ReactNode} from 'react'

export type FormDefinition = {
  schema: JSONSchema
  ui: Record<string, any>
}

/** Optional settings to configure a text field */
export interface FormOptions extends FieldOptions<FormDefinition> {
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: ReactNode
  /** Display a minimal version */
  initialValue?: FormDefinition
}

/** Internal representation of a date field */
export class FormField extends ScalarField<FormDefinition, FormOptions> {}

/** Create a date field configuration */
export function form(
  label: string,
  options: WithoutLabel<FormOptions> = {}
): FormField {
  return new FormField({
    options: {label, ...options},
    view: viewKeys.FormInput
  })
}

export type JSONSchemaType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'object'
  | 'array'
  | 'null'

export interface JSONSchema {
  $id?: string
  $schema?: string
  $ref?: string

  // Basic metadata
  title?: string
  description?: string
  default?: any
  examples?: any[]

  // Type definition
  type?: JSONSchemaType | JSONSchemaType[]

  // Object-specific
  properties?: Record<string, JSONSchema>
  patternProperties?: Record<string, JSONSchema>
  additionalProperties?: boolean | JSONSchema
  required?: string[]
  dependencies?: Record<string, JSONSchema | string[]>
  minProperties?: number
  maxProperties?: number
  propertyNames?: JSONSchema

  // Array-specific
  items?: JSONSchema | JSONSchema[]
  additionalItems?: boolean | JSONSchema
  minItems?: number
  maxItems?: number
  uniqueItems?: boolean
  contains?: JSONSchema

  // String-specific
  minLength?: number
  maxLength?: number
  pattern?: string
  format?: string

  // Number-specific
  minimum?: number
  maximum?: number
  exclusiveMinimum?: number
  exclusiveMaximum?: number
  multipleOf?: number

  // Enum / const
  enum?: any[]
  const?: any

  // Logical combinations
  allOf?: JSONSchema[]
  anyOf?: JSONSchema[]
  oneOf?: JSONSchema[]
  not?: JSONSchema

  // Conditional subschemas
  if?: JSONSchema
  then?: JSONSchema
  else?: JSONSchema

  // Misc
  definitions?: Record<string, JSONSchema>
}
