import {FieldOptions, WithoutLabel} from 'alinea/core/Field'
import {ScalarField} from 'alinea/core/field/ScalarField'

/** Internal representation of a text field */
export class HiddenField<T> extends ScalarField<T, FieldOptions<T>> {}

/** Create a hidden field configuration */
export function hidden<T>(
  label: string,
  options: WithoutLabel<FieldOptions<T>> = {}
): HiddenField<T> {
  return new HiddenField({
    options: {label, ...options},
    view: 'alinea/field/hidden/HiddenField.view#HiddenInput'
  })
}
