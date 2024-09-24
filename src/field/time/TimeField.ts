import {FieldOptions, Hint, WithoutLabel} from 'alinea/core'
import {ScalarField} from 'alinea/core/field/ScalarField'

/** Optional settings to configure a time field */
export interface TimeOptions extends FieldOptions<string> {
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: string
  /** Display a minimal version */
  inline?: boolean
  /** Focus this input automatically */
  autoFocus?: boolean
  /** A minimum value */
  minValue?: string
  /** A maximum value */
  maxValue?: string
  /** Specifies the legal time intervals */
  step?: number
}

/** Internal representation of a date field */
export class TimeField extends ScalarField<string, TimeOptions> {}

/** Create a time field configuration */
export function time(
  label: string,
  options: WithoutLabel<TimeOptions> = {}
): TimeField {
  return new TimeField({
    hint: Hint.String(),
    options: {label, ...options},
    view: 'alinea/field/time/TimeField.view#TimeInput'
  })
}
