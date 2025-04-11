import {Field, type FieldOptions} from './Field.js'

export interface FieldGetter {
  <Value>(field: Field<Value>): Value
}

export interface OptionsTracker<Options = any> {
  (getter: FieldGetter): Partial<Options> | Promise<Partial<Options>>
}

export interface ValueTracker<Value = any> {
  (getter: FieldGetter): Value
}

const optionTrackers = new Map<symbol, OptionsTracker>()

export function optionTrackerOf(field: Field) {
  return optionTrackers.get(Field.ref(field))
}

const valueTrackers = new Map<symbol, ValueTracker>()

export function valueTrackerOf(field: Field) {
  return valueTrackers.get(Field.ref(field))
}

export namespace track {
  export function options<StoredValue, QueryValue, OnChange, Options>(
    field: Field<StoredValue, QueryValue, OnChange, Options>,
    tracker: OptionsTracker<Options & FieldOptions<StoredValue>>
  ): Field<StoredValue, QueryValue, OnChange, Options> {
    optionTrackers.set(Field.ref(field), tracker)
    return field
  }

  export function value<StoredValue, QueryValue, OnChange, Options>(
    field: Field<StoredValue, QueryValue, OnChange, Options>,
    tracker: ValueTracker<StoredValue>
  ): Field<StoredValue, QueryValue, OnChange, Options> {
    valueTrackers.set(Field.ref(field), tracker)
    return field
  }
}
