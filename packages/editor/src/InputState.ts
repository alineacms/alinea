import {RichTextMutator} from '@alinea/core'
import {TextDoc} from '@alinea/core/TextDoc'
import {ListMutator} from '@alinea/core/value/ListValue'

export interface InputState<T = any> {
  child(field: string): InputState<any>
  use(): T
}

/* eslint-disable */
export namespace InputState {
  export type Scalar<T> = readonly [T, (value: T) => void]
  export type List<T> = readonly [Array<T>, ListMutator<T>]
  export type Text<T> = readonly [TextDoc<T>, RichTextMutator<T>]

  export class StatePair<V, M> implements InputState<readonly [V, M]> {
    constructor(public current: V, public mutator: M) {}

    child(field: string) {
      const {mutator} = this
      if (typeof mutator !== 'function')
        throw 'Cannot access child field of non-object'
      const record = this.current as unknown as Record<string, V>
      const current = record[field]
      const mutate = (state: V) => {
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
