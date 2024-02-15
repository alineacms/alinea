import type {LinkResolver} from 'alinea/backend/resolver/LinkResolver'
import * as Y from 'yjs'
import {Label} from './Label.js'

type YType = Y.Map<any>

export interface Shape<Value = any, Mutator = any> {
  initialValue?: Value
  label: Label
  create(): Value
  toY(value: Value): any
  fromY(yValue: any): Value
  applyY(value: Value, parent: YType, key: string): void
  init(parent: YType, key: string): void
  watch(parent: YType, key: string): (fun: () => void) => () => void
  mutator(parent: YType, key: string): Mutator
  applyLinks(value: Value, loader: LinkResolver): Promise<void>
  normalize(value: any): Value
  searchableText(value: Value): string
}
