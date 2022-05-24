import * as Y from 'yjs'
import {Label} from './Label'
import {ListShape} from './shape/ListShape'
import {RecordShape} from './shape/RecordShape'
import {RichTextShape} from './shape/RichTextShape'
import {ScalarShape} from './shape/ScalarShape'

type YType = Y.AbstractType<any>

export interface Shape<T = any, M = any> {
  label: Label
  create(): T
  typeOfChild<C>(yValue: any, child: string): Shape<C>
  toY(value: T): any
  fromY(yValue: any): T
  watch(parent: YType, key: string): (fun: () => void) => void
  mutator(parent: YType, key: string): M
}

export namespace Shape {
  export function Scalar<T>(label: Label) {
    return new ScalarShape<T>(label)
  }
  export function RichText(
    label: Label,
    shapes?: Record<string, RecordShape<any>>
  ) {
    return new RichTextShape(label, shapes)
  }
  export function List(label: Label, shapes: Record<string, RecordShape<any>>) {
    return new ListShape(label, shapes)
  }
  export function Record<T>(
    label: Label,
    shape: Record<string, Shape>
  ): RecordShape<T> {
    return new RecordShape(label, shape)
  }
}
