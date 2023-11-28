import {Hint} from 'alinea/core/Hint'
import {Label} from 'alinea/core/Label'
import {ScalarField} from 'alinea/core/field/ScalarField'

/** Optional settings to configure a hidden field */
export type HiddenOptions<T> = {
  /** A default value */
  initialValue?: T
}

/** Internal representation of a text field */
export class HiddenField<T> extends ScalarField<T, {}> {}

/** Create a hidden field configuration */
export function hidden<T>(
  label: Label,
  hint: Hint,
  options: HiddenOptions<T> = {}
): HiddenField<T> {
  return new HiddenField({
    hint,
    label,
    initialValue: options.initialValue,
    view: () => null,
    options
  })
}
