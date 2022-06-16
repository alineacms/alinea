import {Field, Label, Shape} from '@alinea/core'

/** Optional settings to configure a text field */
export type DateOptions = {
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: Label
  /** Field is optional */
  optional?: boolean
  /** Display a minimal version */
  inline?: boolean
  /** A default value */
  initialValue?: string
  /** Focus this input automatically */
  autoFocus?: boolean
  /** Hide this date field */
  hidden?: boolean
}

/** Internal representation of a date field */
export interface DateField extends Field.Scalar<string> {
  label: Label
  options: DateOptions
}

/** Create a date field configuration */
export function createDate(label: Label, options: DateOptions = {}): DateField {
  return {
    shape: Shape.Scalar(label, options.initialValue),
    label,
    options
  }
}
