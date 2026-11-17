import {Field, type FieldOptions} from './Field.js'
import type {UnionMutator} from './UnionRow.js'

/**
 * The value of a field as an options tracker reads it. Single link fields are
 * stored as null while empty, so they read as possibly null. A field typed
 * without its mutator, eg. `Field<boolean>`, reads as its value.
 */
export type TrackedValue<F> =
  F extends Field<infer Value, any, infer Mutator>
    ? 0 extends 1 & Mutator
      ? Value
      : Mutator extends UnionMutator<any>
        ? Value | null
        : Value
    : never

export interface FieldGetter {
  <F extends Field>(field: F): TrackedValue<F>
}

export interface OptionsTracker<Options = any> {
  (getter: FieldGetter): Partial<Options>
}
const optionTrackers = new Map<symbol, OptionsTracker>()

export function optionTrackerOf(field: Field) {
  return optionTrackers.get(Field.ref(field))
}

export namespace track {
  export function options<StoredValue, QueryValue, OnChange, Options>(
    field: Field<StoredValue, QueryValue, OnChange, Options>,
    tracker: OptionsTracker<Options & FieldOptions<StoredValue>>
  ): Field<StoredValue, QueryValue, OnChange, Options> {
    optionTrackers.set(Field.ref(field), tracker)
    return field
  }
}
