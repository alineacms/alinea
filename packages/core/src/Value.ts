import * as Y from 'yjs'
import {TextDoc} from './TextDoc'
import {ListMutator, ListValue} from './value/ListValue'
import {RecordMutator, RecordValue} from './value/RecordValue'
import {RichTextMutator, RichTextValue} from './value/RichTextValue'
import {ScalarMutator, ScalarValue} from './value/ScalarValue'

type YType = Y.AbstractType<any>

export interface Value<T = any, M = unknown> {
  create(): T
  typeOfChild<C>(yValue: any, child: string): Value<C>
  toY(value: T): any
  fromY(yValue: any): T
  watch(parent: YType, key: string): (fun: () => void) => void
  mutator(parent: YType, key: string): M
}

export namespace Value {
  export type Mutator<T> = T extends TextDoc<infer R>
    ? RichTextMutator<R>
    : T extends Array<infer R>
    ? ListMutator<R>
    : T extends Record<string, any>
    ? RecordMutator<T>
    : T extends string | number
    ? ScalarMutator<T>
    : never

  export const Scalar: Value<any> = ScalarValue.inst
  export function RichText(shapes?: Record<string, RecordValue<any>>) {
    return new RichTextValue(shapes)
  }
  export function List(shapes: Record<string, RecordValue<any>>) {
    return new ListValue(shapes)
  }
  export function Record<T>(shape: Record<string, Value>): RecordValue<T> {
    return new RecordValue(shape)
  }
}
