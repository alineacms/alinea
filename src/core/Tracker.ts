import {Mutation} from 'alinea/core/Mutation'
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

export interface MutationTracker {
  (mutations: Array<Mutation>): Array<Mutation> | Promise<Array<Mutation>>
}

const optionTrackers = new Map<symbol, OptionsTracker>()

export function optionTrackerOf(field: Field) {
  return optionTrackers.get(Field.ref(field))
}

const valueTrackers = new Map<symbol, ValueTracker>()

export function valueTrackerOf(field: Field) {
  return valueTrackers.get(Field.ref(field))
}

const mutationTrackers = new Map<symbol, MutationTracker>()

export namespace track {
  export function options<Value, OnChange, Options extends FieldOptions<Value>>(
    field: Field<Value, OnChange, Options>,
    tracker: OptionsTracker<Options>
  ): void {
    optionTrackers.set(Field.ref(field), tracker)
  }

  export function value<Value>(
    field: Field<Value>,
    tracker: ValueTracker<Value>
  ): void {
    valueTrackers.set(Field.ref(field), tracker)
  }
}
