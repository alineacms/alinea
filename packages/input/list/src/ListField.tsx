import {Field, Label, Schema, Value} from '@alineacms/core'

export type ListOptions<T> = {
  schema: Schema<T>
  help?: Label
  inline?: boolean
  initialValue?: number
}

export interface ListField<T> extends Field.List<T> {
  label: Label
  options: ListOptions<T>
}

export function createList<T>(
  label: Label,
  options: ListOptions<T>
): ListField<T> {
  return {
    type: Value.List(options.schema.valueTypes),
    label,
    options
  }
}
