import {FieldOptions, Type, TypeFields, WithoutLabel, type} from 'alinea/core'
import {RecordField} from 'alinea/core/field/RecordField'

export interface ObjectOptions<Definition>
  extends FieldOptions<Type.Infer<Definition>> {
  fields: Type<Definition>
}

export class ObjectField<Definition> extends RecordField<
  Type.Infer<Definition>,
  ObjectOptions<Definition>
> {}

export function object<Definition extends TypeFields>(
  label: string,
  options: WithoutLabel<{fields: Definition} & FieldOptions<Definition>>
): ObjectField<Definition>
/** @deprecated Define fields directly, without using Type */
export function object<Definition extends TypeFields>(
  label: string,
  options: WithoutLabel<{fields: Type<Definition>} & FieldOptions<Definition>>
): ObjectField<Definition>
export function object<Definition>(
  label: string,
  options: WithoutLabel<{fields: any} & ObjectOptions<Definition>>
): ObjectField<Definition> {
  const fields = Type.isType(options.fields)
    ? options.fields
    : type({fields: options.fields})
  return new ObjectField(Type.shape(fields), {
    hint: Type.hint(fields),
    options: {label, ...options, fields}
  })
}
