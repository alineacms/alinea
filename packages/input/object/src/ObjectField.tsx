import {Field, Label, TypeConfig} from '@alinea/core'

export type ObjectOptions<T> = {
  /** The fields */
  fields: TypeConfig<any, T>
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
  const shape = options.fields.shape
  return {
    shape,
    label,
    options
  }
}
