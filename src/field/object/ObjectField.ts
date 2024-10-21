import type {FieldOptions, WithoutLabel} from 'alinea/core/Field'
import {FieldsDefinition, Type, type} from 'alinea/core/Type'
import {RecordField} from 'alinea/core/field/RecordField'

export interface ObjectOptions<Definition>
  extends FieldOptions<Type.Infer<Definition>> {
  fields: Type<Definition>
}

export class ObjectField<Definition> extends RecordField<
  Type.Infer<Definition>,
  ObjectOptions<Definition>
> {}

export function object<Definition extends FieldsDefinition>(
  label: string,
  options: WithoutLabel<
    {fields: Definition} & FieldOptions<Type.Infer<Definition>>
  >
): ObjectField<Definition> {
  const fields: Type<Definition> = type({fields: options.fields})
  return new ObjectField(fields, {
    options: {label, ...options, fields},
    view: 'alinea/field/object/ObjectField.view#ObjectInput'
  })
}
