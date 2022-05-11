import {Field, Label, Type} from '@alinea/core'

export type ObjectOptions<T> = {
  /** The fields */
  fields: Type<T>
  width?: number
  help?: Label
  inline?: boolean
}

export interface ObjectField<T> extends Field.Record<T> {
  label: Label
  options: ObjectOptions<T>
}

export function createObject<T>(
  label: Label,
  options: ObjectOptions<T>
): ObjectField<T> {
  return {
    type: options.fields.valueType,
    label,
    options
  }
}
