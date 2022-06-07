import {Field, Label, Shape} from '@alinea/core'

/** A string record with option labels */
export type SelectItems<T extends string> = {
  [K in T]: Label
}

/** Optional settings to configure a select field */
export type SelectOptions<T> = {
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: Label
  /** Field is optional */
  optional?: boolean
  /** Display a minimal version */
  inline?: boolean
  /** Choose a custom placeholder (eg. 'Select an option')  */
  placeholder?: Label
  /** A default value */
  initialValue?: T
}

/** Internal representation of a select field */
export interface SelectField<T extends string = string>
  extends Field.Scalar<T> {
  label: Label
  items: SelectItems<T>
  options: SelectOptions<T>
  configure: (options: SelectOptions<T>) => SelectField<T>
}

/** Create a select field configuration */
export function createSelect<T extends string>(
  label: Label,
  items: SelectItems<T>,
  options: SelectOptions<T> = {}
): SelectField<T> {
  return {
    shape: Shape.Scalar(label, options.initialValue),
    label,
    items,
    options,
    initialValue: options.initialValue,
    configure(options: SelectOptions<T>) {
      return createSelect<T>(label, items, options)
    }
  }
}
