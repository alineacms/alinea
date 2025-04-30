import type {FieldOptions, WithoutLabel} from 'alinea/core/Field'
import {type FieldsDefinition, type Type, type} from 'alinea/core/Type'
import {RecordField} from 'alinea/core/field/RecordField'
import {viewKeys} from 'alinea/dashboard/editor/ViewKeys'

export interface ObjectOptions<Definition>
  extends FieldOptions<Type.Infer<Definition>> {
  fields: Type<Definition>
}

export class ObjectField<Definition> extends RecordField<
  Type.Infer<Definition>,
  ObjectOptions<Definition>
> {}

export function object<Fields extends FieldsDefinition>(
  label: string,
  options: WithoutLabel<{fields: Fields} & FieldOptions<Type.Infer<Fields>>>
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
