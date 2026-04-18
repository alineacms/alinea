import type {FieldOptions, WithoutLabel} from '#/core/Field.js'
import {RecordField} from '#/core/field/RecordField.js'
import {type FieldsDefinition, Type, type} from '#/core/Type.js'
import {viewKeys} from '#/dashboard/ViewKeys.js'
import type {ReactNode} from 'react'

export interface ObjectOptions<Definition> extends FieldOptions<
  Type.Infer<Definition>
> {
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
  const initialValue = Type.initialValue(fields) as any
  return Object.assign(
    new ObjectField(fields, {
      options: {
        label,
        initialValue,
        ...options,
        fields
      },
      view: viewKeys.ObjectInput
    }),
    fields
  )
}
