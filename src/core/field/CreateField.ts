import type {Field, FieldOptions, WithoutLabel} from '../Field.js'
import type {Expand} from '../util/Types.js'
import type {View} from '../View.js'
import {ScalarField} from './ScalarField.js'

export interface Create<Value, Options = object>
  extends ScalarField<Value, FieldOptions<Value> & Options> {}

export type Options<F> = Expand<
  F extends Field<any, any, any, infer Options>
    ? WithoutLabel<Options & FieldOptions<any>>
    : WithoutLabel<FieldOptions<any>>
>

export interface CreateConfig<Value, Options> {
  label: string
  options: Options
  view: View<{field: ScalarField<Value, Options>}>
}

export function create<Value, Options>({
  label,
  options,
  view
}: CreateConfig<Value, Options>): Create<Value, Options> {
  return new ScalarField<Value, {label: string} & Options>({
    options: {label, ...options},
    view
  })
}
