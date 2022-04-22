import {Field, Label, Schema, Value} from '@alinea/core'

/** Optional settings to configure a list field */
export type ListOptions<T> = {
  /** Allow these types of blocks to be created */
  schema: Schema<T>
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: Label
  /** Field is optional */
  optional?: boolean
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
