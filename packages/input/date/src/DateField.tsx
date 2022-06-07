import {Field, Label, Value} from '@alinea/core'

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
}

/** Internal representation of a text field */
export interface DateField extends Field.Scalar<string> {
  label: Label
  options: DateOptions
}

/** Create a text field configuration */
export function createDate(label: Label, options: DateOptions = {}): DateField {
  return {
    type: Value.Scalar(label),
    label,
    options
  }
}
