import {Field, Label, Schema, Type} from '@alinea/core'

export type ListOptions<T> = {
  schema: Schema<T>
  help?: Label
  inline?: boolean
  initialValue?: number
}

export interface ListField<T> extends Field<Array<T>> {
  label: Label
  options: ListOptions<any>
}

export function createList<T>(
  label: Label,
  options: ListOptions<T>
): ListField<T> {
  return {
    type: Type.List(options.schema.types),
    label,
    options
  }
}
