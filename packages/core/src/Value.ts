import * as Y from 'yjs'
import {ListValue} from './type/ListValue'
import {RecordValue} from './type/RecordValue'
import {RichTextValue} from './type/RichTextValue'
import {ScalarValue} from './type/ScalarValue'

type YType = Y.AbstractType<any>

export interface Value<T = any> {
  toY(value: T): any
  fromY(value: any): T
  watch(parent: YType, key: string): (fun: () => void) => void
  mutator(parent: YType, key: string): any // Todo: infer type
}

export namespace Value {
  export type Mutator<T> = any
  export const Scalar = ScalarValue.inst
  export function RichText(shapes?: Record<string, RecordValue<any>>) {
    return new RichTextValue(shapes)
  }
  export function List(shapes: Record<string, RecordValue<any>>) {
    return new ListValue(shapes)
  }
  export function Record(shape: Record<string, Value>) {
    return new RecordValue(shape)
  }
}
