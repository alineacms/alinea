import {Field, FieldOptions, Hint, Label} from 'alinea/core'

/** Optional settings to configure a text field */
export interface DateOptions extends FieldOptions {
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
  /** Make this date field read-only*/
  readOnly?: boolean
}

/** Internal representation of a date field */
export class DateField extends Field.Scalar<string, DateOptions> {}

/** Create a date field configuration */
export function date(label: Label, options: DateOptions = {}): DateField {
  return new DateField({
    hint: Hint.String(),
    label,
    options,
    initialValue: options.initialValue
  })
}
