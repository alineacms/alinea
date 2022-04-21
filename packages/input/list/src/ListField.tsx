import {Field, Label, Schema, Value} from '@alinea/core'

/** Optional settings to configure a list field */
export type ListOptions<T> = {
  /** Allow these types of blocks to be created */
  schema: Schema<T>
  /** Add instructional text to a field */
  help?: Label
  /** Display a minimal version */
  inline?: boolean
}

/** Internal representation of a list field */
export interface ListField<T> extends Field.List<T> {
  label: Label
  options: ListOptions<T>
}

/** Create a list field configuration */
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
