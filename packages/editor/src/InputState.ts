import {Value} from '@alinea/core'

export type InputPair<T> = readonly [T, Value.Mutator<T>]

export interface InputState<T = any> {
  child<T>(field: string): InputState<T>
  use(): InputPair<T>
}

/* eslint-disable */
export namespace InputState {
  export class StatePair<T> implements InputState<T> {
    constructor(public current: T, public mutator: Value.Mutator<T>) {}

    child<T>(field: string) {
      const {mutator} = this
      if (typeof mutator !== 'function')
        throw 'Cannot access child field of non-object'
      const record = this.current as unknown as Record<string, T>
      const current = record[field]
      const mutate = (state: T) => {
        mutator({...this.current, [field]: state})
      }
      // We don't have any field information here so we can only assume
      // we're dealing with a scalar value. If not this will result in
      // confusing runtime errors. Maybe we could always use Y types below the
      // surface?
      return new StatePair(current, mutate as any)
    }

    use() {
      return [this.current, this.mutator] as const
    }
  }
}
