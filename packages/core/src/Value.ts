import * as Y from 'yjs'
import {Label} from './Label'
import {ListValue} from './value/ListValue'
import {RecordValue} from './value/RecordValue'
import {RichTextValue} from './value/RichTextValue'
import {ScalarValue} from './value/ScalarValue'
import {ValueKind} from './ValueKind'

type YType = Y.AbstractType<any>

export interface Value<T = any, M = any> {
  kind: ValueKind
  label: Label
  create(): T
  typeOfChild<C>(yValue: any, child: string): Value<C>
  toY(value: T): any
  fromY(yValue: any): T
  watch(parent: YType, key: string): (fun: () => void) => void
  mutator(parent: YType, key: string): M
}

export namespace Value {
  export function Scalar<T>(label: Label) {
    return new ScalarValue<T>(label)
  }
  export function RichText(
    label: Label,
    shapes?: Record<string, RecordValue<any>>
  ) {
    return new RichTextValue(label, shapes)
  }
  export function List(label: Label, shapes: Record<string, RecordValue<any>>) {
    return new ListValue(label, shapes)
  }
  export function Record<T>(
    label: Label,
    shape: Record<string, Value>
  ): RecordValue<T> {
    return new RecordValue(label, shape)
  }
}
