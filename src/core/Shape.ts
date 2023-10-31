import {LinkResolver} from 'alinea/backend/resolver/LinkResolver'
import * as Y from 'yjs'
import {Label} from './Label.js'
import {RecordShape} from './shape/RecordShape.js'

type YType = Y.Doc | Y.Map<any>

export interface ShapeInfo {
  name: string
  parents: Array<string>
  shape: RecordShape
}

export interface Shape<Value = any, OnChange = any> {
  label: Label
  innerTypes(parents: Array<string>): Array<ShapeInfo>
  create(): Value
  typeOfChild<C>(yValue: any, child: string): Shape<C, unknown>
  toY(value: Value): any
  fromY(yValue: any): Value
  applyY(value: Value, parent: YType, key: string): void
  watch(parent: YType, key: string): (fun: () => void) => void
  mutator(parent: YType, key: string): OnChange
  toString(): string
  applyLinks(value: Value, loader: LinkResolver): Promise<void>
}
