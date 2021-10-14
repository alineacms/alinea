import {Field, Label, Schema, Value} from '@alinea/core'

export type ListOptions<T extends {$channel: string}> = {
  schema: Schema<T>
  help?: Label
  inline?: boolean
  initialValue?: number
}

export type ListField<T> = Field<Array<T>> & {
  label: Label
  options: ListOptions<any>
}

export function createList<T extends {$channel: string}>(
  label: Label,
  options: ListOptions<T>
): ListField<T> {
  return {
    value: Value.List,
    label,
    options
  }
}
