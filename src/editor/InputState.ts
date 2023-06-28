import {RichTextMutator, Shape} from 'alinea/core'
import {TextDoc} from 'alinea/core/TextDoc'
import {ListMutator} from 'alinea/core/shape/ListShape'
import {RecordMutator} from 'alinea/core/shape/RecordShape'
import {UnionMutator} from 'alinea/core/shape/UnionShape'
import {useForceUpdate} from 'alinea/ui/hook/UseForceUpdate'
import {useEffect} from 'react'
import * as Y from 'yjs'

export interface InputState<T = any> {
  parent(): InputState<any> | undefined
  child(field: string): InputState<any>
  use(): T
}

// Todo: rewrite this based on atoms?

/* eslint-disable */
export namespace InputState {
  export type Scalar<T> = readonly [T, (value: T) => void]
  export type Record<T> = readonly [T, RecordMutator<T>]
  export type List<T> = readonly [Array<T>, ListMutator<T>]
  export type Text<T> = readonly [TextDoc<T>, RichTextMutator<T>]
  export type Union<T> = readonly [T, UnionMutator<T>]

  export class YDocState<V, M> implements InputState<readonly [V, M]> {
    constructor(
      protected shape: Shape<V, M>,
      protected parentData: Y.Map<any>,
      protected key: string | undefined,
      protected _parent?: InputState<any>
    ) {}
    parent() {
      return this._parent
    }
    child(field: string): InputState<any> {
      const {shape, parentData: data, key} = this
      const child = key ? data.get(key) : data
      return new YDocState(shape.typeOfChild(child, field), child, field, this)
    }
    use() {
      const value = this.key ? this.parentData.get(this.key) : this.parentData
      const listener = this.shape.watch(this.parentData, this.key!)
      const forceUpdate = useForceUpdate()
      useEffect(() => listener(forceUpdate), [this])
      return [
        this.shape.fromY(value),
        this.shape.mutator(this.parentData, this.key!)
      ] as const
    }
  }

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
      const record = this.current as unknown as {[key: string]: V}
      const current = record[field]
      const mutate = (state: V) => {
        if (typeof mutator !== 'function')
          throw 'Cannot access child field of non-object'
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
