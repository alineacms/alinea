import type {Field, FieldOptions, WithoutLabel} from '../Field.js'
import {Field as FieldInstance} from '../Field.js'
import type {Expand} from '../util/Types.js'
import type {View} from '../View.js'

// A type alias rather than an interface: fields are then compared by their
// options, so `Create<V, WithoutLabel<Opts>>` is assignable to `Create<V, Opts>`
export type Create<Value, Options = object> = Field<
  Value,
  Value,
  (value: Value) => void,
  FieldOptions<Value> & Options
>

export type Options<F> = Expand<
  F extends Field<any, any, any, infer Options>
    ? WithoutLabel<Options & FieldOptions<any>>
    : WithoutLabel<FieldOptions<any>>
>

export interface CreateConfig<Value, Options> {
  label: string
  options: Options
  view: View<{field: Create<Value, Options>}>
  defaultValue?: () => Value
  searchableText?: (value: Value) => string
}

export function create<Value, Options>({
  label,
  options,
  view,
  defaultValue,
  searchableText
}: CreateConfig<Value, Options>): Create<Value, Options> {
  return new FieldInstance<
    Value,
    Value,
    (value: Value) => void,
    {label: string} & Options
  >({
    options: {label, ...options},
    view,
    defaultValue,
    searchableText
  })
}
