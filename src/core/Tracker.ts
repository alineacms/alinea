import {Field, FieldOptions} from './Field.js'

export interface FieldGetter {
  <Value>(field: Field<Value>): Value
}

export interface OptionsTracker<Options = any> {
  (getter: FieldGetter): Partial<Options> | Promise<Partial<Options>>
}

export interface ValueTracker<Value = any> {
  (getter: FieldGetter): Value
}

const optionTrackers = new WeakMap<symbol, OptionsTracker>()
const valueTrackers = new WeakMap<symbol, ValueTracker>()

export namespace track {
  export function options<Value, OnChange, Options extends FieldOptions>(
    field: Field<Value, OnChange, Options>,
    tracker: OptionsTracker<Options>
  ): void {
    optionTrackers.set(Field.ref(field), tracker)
  }

  export function optionTrackerOf(field: Field) {
    return optionTrackers.get(Field.ref(field))
  }

  /*
  export function value<Value, OnChange, Options extends FieldOptions>(
    field: Field<Value, OnChange, Options>,
    tracker: ValueTracker<Value>
  ): void {
    valueTrackers.set(Field.ref(field), tracker)
  }

  export function valueTrackerOf(field: Field) {
    return valueTrackers.get(Field.ref(field))
  }
  */
}
