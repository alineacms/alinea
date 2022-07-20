// Todo: extract interface and place it in core
import type { Pages } from '@alinea/backend/Pages'
import { InputState } from '@alinea/editor'
import { Expr } from '@alinea/store'
import type { ComponentType } from 'react'
import { Label } from './Label'
import { Shape } from './Shape'
import { ListMutator } from './shape/ListShape'
import { RecordMutator } from './shape/RecordShape'
import { RichTextMutator } from './shape/RichTextShape'
import { TextDoc } from './TextDoc'

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
    const factory = (...args: Parameters<C>) => {
      const field: any = create(...args)
      if ('configure' in field) {
        const configure = field.configure
        // Todo: make this recursive
        field.configure = (...args: Array<any>) => {
          return {...configure(...args), view}
        }
      }
      return {...field, view}
    }
    return factory as any
  }

  export type Scalar<T, Q = T> = Field<T, (state: T) => void, Q>
  export type List<T, Q = T> = Field<Array<T>, ListMutator<T>, Q>
  export type Record<T, Q = T> = Field<T, RecordMutator<T>, Q>
  export type Text<T, Q = T> = Field<TextDoc<T>, RichTextMutator<T>, Q>
}

export interface Field<V, M, Q = V> {
  shape: Shape<V, M>
  label: Label
  initialValue?: V
  view?: FieldRenderer<V, M, Field<V, M, Q>>
  transform?: (field: Expr<V>, pages: Pages<any>) => Expr<Q> | undefined
  hidden?: boolean
}
