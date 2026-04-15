import type {FieldOptions, WithoutLabel} from '#/core/Field.js'
import {ScalarField} from '#/core/field/ScalarField.js'
import {viewKeys} from '#/core/ViewKeys.js'

/** Internal representation of a text field */
export class HiddenField<T> extends ScalarField<T, FieldOptions<T>> {}

/** Create a hidden field configuration */
export function hidden<T>(
  label: string,
  options: WithoutLabel<FieldOptions<T>> = {}
): HiddenField<T> {
  return new HiddenField({
    options: {label, ...options},
    view: viewKeys.HiddenInput
  })
}
