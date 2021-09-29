import * as Y from 'yjs'
import {ListValue} from './ListValue'
import {RecordValue} from './RecordValue'
import {ScalarValue} from './ScalarValue'

export enum Value {
  Scalar,
  Record,
  List
}

export namespace Value {
  export type Mutator<T> = T extends Array<infer K>
    ? K extends ListValue.Row
      ? ListValue.Mutator<K>
      : never
    : T extends {[key: string]: any}
    ? RecordValue.Mutator<T>
    : ScalarValue.Mutator<T>
  // Todo: rely on runtime or schema information to construct these?
  // We should probably force runtime type correctness before running this anyway
  export function toY(value: any) {
    if (Array.isArray(value)) return ListValue.toY(value)
    if (value && typeof value === 'object') return RecordValue.toY(value)
    return ScalarValue.toY(value)
  }
  export function fromY(value: any): any {
    if (value instanceof Y.Map) {
      const type: Value = value.get('$type')
      switch (type) {
        case Value.List:
          return ListValue.fromY(value)
        case Value.Record:
          return RecordValue.fromY(value)
      }
    }
    return value
  }
  export function watch(type: Value, parent: Y.Map<any>, key: string) {
    switch (type) {
      case Value.Scalar:
        return ScalarValue.watch(parent, key)
      case Value.Record:
        return RecordValue.watch(parent, key)
      case Value.List:
        return ListValue.watch(parent, key)
    }
  }
  export function mutator<T>(
    type: Value,
    parent: Y.Map<any>,
    key: string
  ): Mutator<T> {
    switch (type) {
      case Value.Scalar:
        return ScalarValue.mutator(parent, key) as any
      case Value.Record:
        return RecordValue.mutator(parent, key) as any
      case Value.List:
        return ListValue.mutator(parent, key) as any
    }
  }
}
