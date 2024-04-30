import {Field, FieldOptions} from './Field.js'
import {Mutation} from './Mutation.js'

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

export namespace track {
  export function options<Fields extends Array<Field>>(
    fields: Fields,
    tracker: OptionsTracker<
      Fields[number] extends Field<any, any, any, infer O> ? O : any
    >
  ): void
  export function options<
    StoredValue,
    QueryValue,
    OnChange,
    Options extends FieldOptions<StoredValue>
  >(
    field: Field<StoredValue, QueryValue, OnChange, Options>,
    tracker: OptionsTracker<Options>
  ): Field<StoredValue, QueryValue, OnChange, Options>
  export function options(
    fields: Field | Array<Field>,
    tracker: OptionsTracker
  ) {
    if (Array.isArray(fields)) {
      fields.forEach(field => optionTrackers.set(Field.ref(field), tracker))
    } else {
      optionTrackers.set(Field.ref(fields), tracker)
      return fields
    }
  }

  export function value<
    StoredValue,
    QueryValue,
    OnChange,
    Options extends FieldOptions<StoredValue>
  >(
    field: Field<StoredValue, QueryValue, OnChange, Options>,
    tracker: ValueTracker<StoredValue>
  ): Field<StoredValue, QueryValue, OnChange, Options> {
    valueTrackers.set(Field.ref(field), tracker)
    return field
  }
}
