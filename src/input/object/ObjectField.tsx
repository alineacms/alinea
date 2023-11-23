import {Field, FieldOptions, Label, Type} from 'alinea/core'

export interface ObjectOptions<Definition> extends FieldOptions {
  /** The fields */
  fields: Type<Definition>
  width?: number
  help?: Label
  inline?: boolean
}

export class ObjectField<Definition> extends Field.Record<
  Type.Infer<Definition>,
  ObjectOptions<Definition>
> {}

export function object<Definition>(
  label: Label,
  options: ObjectOptions<Definition>
): ObjectField<Definition> {
  return new ObjectField(Type.shape(options.fields), {
    hint: Type.hint(options.fields),
    label,
    options
  })
}
