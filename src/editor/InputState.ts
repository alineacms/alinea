import {RichTextMutator} from 'alinea/core'
import {ListMutator} from 'alinea/core/shape/ListShape'
import {RecordMutator} from 'alinea/core/shape/RecordShape'
import {TextDoc} from 'alinea/core/TextDoc'

export interface InputState<T = any> {
  parent(): InputState<any> | undefined
  child(field: string): InputState<any>
  use(): T
}

/* eslint-disable */
export namespace InputState {
  export type Scalar<T> = readonly [T, (value: T) => void]
  export type Record<T> = readonly [T, RecordMutator<T>]
  export type List<T> = readonly [Array<T>, ListMutator<T>]
  export type Text<T> = readonly [TextDoc<T>, RichTextMutator<T>]

  export class StatePair<V, M> implements InputState<readonly [V, M]> {
    constructor(
      public current: V,
      public mutator: M,
      private _parent?: InputState<any>
    ) {}

    parent() {
      return this._parent
    }

    child(field: string): InputState<any> {
      const {mutator} = this
      if (typeof mutator !== 'function')
        throw 'Cannot access child field of non-object'
      const record = this.current as unknown as {[key: string]: V}
      const current = record[field]
      const mutate = (state: V) => {
        mutator({...this.current, [field]: state})
      }
      // We don't have any field information here so we can only assume
      // we're dealing with a scalar value. If not this will result in
      // confusing runtime errors. Maybe we could always use Y types below the
      // surface?
      return new StatePair(current, mutate as any, this)
    }

    use() {
      return [this.current, this.mutator] as const
    }
  }
}
