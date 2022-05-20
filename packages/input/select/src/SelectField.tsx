import {Field, Label, Shape} from '@alinea/core'

/** A string record with option labels */
export type SelectItems = {
  [key: string]: Label
}

/** Optional settings to configure a select field */
export type SelectOptions = {
  /** Add instructional text to a field */
  help?: Label
  /** Field is optional */
  optional?: boolean
  /** Display a minimal version */
  inline?: boolean
  /** A default value */
  initialValue?: string
}

/** Internal representation of a select field */
export interface SelectField extends Field.Scalar<string | undefined> {
  label: Label
  items: SelectItems
  options: SelectOptions
}

/** Create a select field configuration */
export function createSelect(
  label: Label,
  items: SelectItems,
  options: SelectOptions = {}
): SelectField {
  return {
    shape: Shape.Scalar(label),
    label,
    items,
    options
  }
}
