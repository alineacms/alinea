import {FieldOptions, WithoutLabel} from 'alinea/core/Field'
import {Hint} from 'alinea/core/Hint'
import {ScalarField} from 'alinea/core/field/ScalarField'

/** Internal representation of a text field */
export class HiddenField<T> extends ScalarField<T, FieldOptions<T>> {}

/** Create a hidden field configuration */
export function hidden<T>(
  label: string,
  hint: Hint,
  options: WithoutLabel<FieldOptions<T>> = {}
): HiddenField<T> {
  return new HiddenField({
    hint,
    view: () => null,
    options: {label, ...options}
  })
}
