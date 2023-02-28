import {Field, Label, Shape} from 'alinea/core'
import {Hint} from 'alinea/core/Hint'

/** Optional settings to configure a text field */
export type HiddenOptions<T> = {
  /** A default value */
  initialValue?: T
}

/** Internal representation of a text field */
export interface HiddenField<T> extends Field.Scalar<T> {
  label: Label
}

/** Create a hidden field configuration */
export function hidden<T>(
  label: Label,
  hint: Hint,
  options: HiddenOptions<T> = {}
): HiddenField<T> {
  const shape = Shape.Scalar(label, options.initialValue)
  return {
    shape,
    hint,
    label,
    initialValue: options.initialValue,
    view: () => null
  }
}
