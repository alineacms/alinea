import {Field, Label, Schema, Value} from '@alinea/core'

export type ListOptions<T> = {
  schema: Schema<T>
  help?: Label
  inline?: boolean
  initialValue?: number
}

export type ListField<T> = Field<Array<T>> & {
  label: Label
  options: ListOptions<any>
}

export function createList<T>(
  label: Label,
  options: ListOptions<T>
): ListField<T> {
  return {
    value: Value.List,
    label,
    options
  }
}
