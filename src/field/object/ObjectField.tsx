import {FieldOptions, Type, WithoutLabel} from 'alinea/core'
import {RecordField} from 'alinea/core/field/RecordField'

export interface ObjectOptions<Definition>
  extends FieldOptions<Type.Infer<Definition>> {
  /** The fields */
  fields: Type<Definition>
  width?: number
  help?: string
  inline?: boolean
}

export class ObjectField<Definition> extends RecordField<
  Type.Infer<Definition>,
  ObjectOptions<Definition>
> {}

export function object<Definition>(
  label: string,
  options: WithoutLabel<ObjectOptions<Definition>>
): ObjectField<Definition> {
  return new ObjectField(Type.shape(options.fields), {
    hint: Type.hint(options.fields),
    options: {label, ...options}
  })
}
