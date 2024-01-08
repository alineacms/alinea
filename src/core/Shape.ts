import {LinkResolver} from 'alinea/backend/resolver/LinkResolver'
import * as Y from 'yjs'
import {Label} from './Label.js'
import {RecordShape} from './shape/RecordShape.js'

type YType = Y.Map<any>

export interface ShapeInfo {
  name: string
  parents: Array<string>
  shape: RecordShape
}

export interface Shape<Value = any, Mutator = any> {
  initialValue?: Value
  label: Label
  innerTypes(parents: Array<string>): Array<ShapeInfo>
  create(): Value
  typeOfChild<C>(yValue: any, child: string): Shape<C, unknown>
  toY(value: Value): any
  fromY(yValue: any): Value
  applyY(value: Value, parent: YType, key: string): void
  init(parent: YType, key: string): void
  watch(parent: YType, key: string): (fun: () => void) => () => void
  mutator(parent: YType, key: string, readOnly: boolean): Mutator
  toString(): string
  applyLinks(value: Value, loader: LinkResolver): Promise<void>
}
