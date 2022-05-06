import {Field, Label, Value} from '@alinea/core'

/** Optional settings to configure a text field */
export type CheckOptions = {
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: Label
  /** Field is optional */
  optional?: boolean
  /** Display a minimal version */
  inline?: boolean
  /** A default value */
  initialValue?: boolean
  /** Focus this input automatically */
  autoFocus?: boolean
}

/** Internal representation of a text field */
export interface CheckField extends Field.Scalar<boolean> {
  label: Label
  options: CheckOptions
}

/** Create a text field configuration */
export function createCheck(
  label: Label,
  options: CheckOptions = {}
): CheckField {
  return {
    type: Value.Scalar(label),
    label,
    options
  }
}
