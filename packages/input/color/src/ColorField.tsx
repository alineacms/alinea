import {Field, Label, Value} from '@alinea/core'

/** Optional settings to configure a color field */
export type ColorOptions = {
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
  /** List of allowed hex codes */
  allowedColors?: Array<string>
}

/** Internal representation of a text field */
export interface ColorField extends Field.Scalar<string> {
  label: Label
  options: ColorOptions
}

/** Create a text field configuration */
export function createColor(
  label: Label,
  options: ColorOptions = {}
): ColorField {
  return {
    type: Value.Scalar,
    label,
    options
  }
}
