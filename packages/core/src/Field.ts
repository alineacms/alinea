// Todo: extract interface and place it in core
import type {Pages} from '@alinea/backend/Pages'
import {InputState} from '@alinea/editor'
import {Expr} from '@alinea/store'
import type {ComponentType} from 'react'
import {Label} from './Label'
import {TextDoc} from './TextDoc'
import {Value} from './Value'
import {ListMutator} from './value/ListValue'
import {RecordMutator} from './value/RecordValue'
import {RichTextMutator} from './value/RichTextValue'

export type FieldRenderer<V, M, F> = ComponentType<{
  state: InputState<readonly [V, M]>
  field: F
}>

export namespace Field {
  export function withView<
    V,
    M,
    Q,
    F extends Field<V, M, Q>,
    C extends (...args: Array<any>) => F
  >(create: C, view: FieldRenderer<V, M, F>): C {
    return ((...args: Parameters<C>) => {
      return {...create(...args), view}
    }) as any
  }

  export type Scalar<T, Q = T> = Field<T, (state: T) => void, Q>
  export type List<T, Q = T> = Field<Array<T>, ListMutator<T>, Q>
  export type Record<T, Q = T> = Field<T, RecordMutator<T>, Q>
  export type Text<T, Q = T> = Field<TextDoc<T>, RichTextMutator<T>, Q>
}

export interface Field<V, M, Q = V> {
  type: Value<V, M>
  label: Label
  view?: FieldRenderer<V, M, Field<V, M, Q>>
  query?: <P>(field: Expr<V>, pages: Pages<P>) => Expr<Q>
}
