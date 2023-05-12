import * as Y from 'yjs'
import {Label} from './Label.js'
import {TextDoc} from './TextDoc.js'
import {ListShape} from './shape/ListShape.js'
import {RecordShape} from './shape/RecordShape.js'
import {RichTextShape} from './shape/RichTextShape.js'
import {ScalarShape} from './shape/ScalarShape.js'

type YType = Y.AbstractType<any>

export interface ShapeInfo {
  name: string
  parents: Array<string>
  shape: RecordShape
}

export interface Shape<T = any, M = any> {
  label: Label
  innerTypes(parents: Array<string>): Array<ShapeInfo>
  create(): T
  typeOfChild<C>(yValue: any, child: string): Shape<C, unknown>
  toY(value: T): any
  fromY(yValue: any): T
  watch(parent: YType, key: string): (fun: () => void) => void
  mutator(parent: Y.Doc | YType, key: string): M
  toString(): string
}

export namespace Shape {
  export function Scalar<T>(label: Label, initialValue?: T) {
    return new ScalarShape<T>(label, initialValue)
  }
  export function RichText(
    label: Label,
    shapes?: Record<string, RecordShape<any>>,
    initialValue?: TextDoc<any>
  ) {
    return new RichTextShape(label, shapes, initialValue)
  }
  export function List(
    label: Label,
    shapes: Record<string, RecordShape<any>>,
    initialValue?: Array<any>
  ) {
    return new ListShape(label, shapes, initialValue)
  }
  export function Record<T>(
    label: Label,
    shape: Record<string, Shape<any, unknown>>,
    initialValue?: T
  ): RecordShape<T> {
    return new RecordShape(label, shape, initialValue)
  }
}
