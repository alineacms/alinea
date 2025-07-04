import type {FieldOptions, WithoutLabel} from 'alinea/core/Field'
import {type FieldsDefinition, type Type, type} from 'alinea/core/Type'
import {RecordField} from 'alinea/core/field/RecordField'
import {viewKeys} from 'alinea/dashboard/editor/ViewKeys'
import type {ReactNode} from 'react'

export interface ObjectOptions<Definition>
  extends FieldOptions<Type.Infer<Definition>> {
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: ReactNode
  /** Display a minimal version */
  inline?: boolean
}

export class ObjectField<Definition> extends RecordField<
  Type.Infer<Definition>,
  ObjectOptions<Definition> & {fields: Type<Definition>}
> {}

export function object<Fields extends FieldsDefinition>(
  label: string,
  options: WithoutLabel<ObjectOptions<Fields> & {fields: Fields}>
): ObjectField<Fields> & Fields {
  const fields: Type<Fields> = type('Object fields', {
    fields: options.fields
  })
  return Object.assign(
    new ObjectField(fields, {
      options: {label, ...options, fields},
      view: viewKeys.ObjectInput
    }),
    fields
  )
}
