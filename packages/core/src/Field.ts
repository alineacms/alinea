import {InputState} from '@alinea/editor'
import type {ComponentType} from 'react'
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
    F extends Field<V, M>,
    C extends (...args: Array<any>) => F
  >(create: C, view: FieldRenderer<V, M, F>): C {
    return ((...args: Parameters<C>) => {
      return {...create(...args), view}
    }) as any
  }

  export type Scalar<T> = Field<T, (state: T) => void>
  export type List<T> = Field<Array<T>, ListMutator<T>>
  export type Record<T> = Field<T, RecordMutator<T>>
  export type Text<T> = Field<TextDoc<T>, RichTextMutator<T>>
}

export interface Field<V, M> {
  type: Value<V, M>
  view?: FieldRenderer<V, M, Field<V, M>>
}
