import * as Y from 'yjs'
import {Value} from './Value'

export type RecordValue<T> = Record<string, T>

export namespace RecordValue {
  export type Mutator<T> = {
    set<K extends keyof T>(key: K, value: T[K]): void
  }
  export function toY<T>(value: RecordValue<T>) {
    const map = new Y.Map()
    map.set('$type', Value.Record)
    Object.keys(value).forEach(key => {
      map.set(key, Value.toY(value[key]))
    })
    return map
  }
  export function fromY<T>(map: Y.Map<T>) {
    const res: RecordValue<T> = {}
    for (const key of map.keys()) {
      if (key !== '$type') res[key] = Value.fromY(map.get(key))
    }
    return res
  }
  export function mutator<T>(parent: Y.Map<any>, key: string): Mutator<T> {
    return {
      set<K extends keyof T>(k: K, v: T[K]) {
        const record = parent.get(key)
        record.set(key, Value.toY(v))
      }
    }
  }
}
