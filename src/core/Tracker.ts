import {Field} from './Field.js'

export interface FieldGetter {
  <Value>(field: Field<Value>): Value
}

export interface OptionsTracker<Options = any> {
  (getter: FieldGetter): Partial<Options>
}

const optionTrackers = new WeakMap<Field, OptionsTracker>()

export namespace track {
  export function options<Value, OnChange, Options>(
    field: Field<Value, OnChange, Options>,
    tracker: OptionsTracker<Options>
  ): void {
    optionTrackers.set(field as Field, tracker)
  }
}
