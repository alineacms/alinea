import {Field, type FieldOptions} from './Field.js'

export interface FieldGetter {
  <Value>(field: Field<Value>): Value
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
