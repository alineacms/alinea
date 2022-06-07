import {Field, Label, Shape} from '@alinea/core'

/** Optional settings to configure a text field */
export type HiddenOptions<T> = {
  /** A default value */
  initialValue?: T
}

/** Internal representation of a text field */
export interface HiddenField<T> extends Field.Scalar<T> {
  label: Label
}

/** Create a text field configuration */
export function createHidden<T>(
  label: Label,
  options: HiddenOptions<T> = {}
): HiddenField<T> {
  return {
    shape: Shape.Scalar(label, options.initialValue),
    label,
    initialValue: options.initialValue,
    view: () => null
  }
}
