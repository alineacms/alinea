import * as Y from 'yjs'
import {Value} from './Value'

export type ListValue<T> = Array<ListValue.Row>

export namespace ListValue {
  export type Row = {
    $id: string
    $index: string
    $channel: string
  }
  export type Mutator<T extends Row> = {
    push: (row: T) => void
    delete: (id: string) => void
  }
  export function toY<T>(value: ListValue<T>) {
    const map = new Y.Map()
    map.set('$type', Value.List)
    const values = value
      .filter(row => Boolean(row.$index))
      .sort((a, b) => a.$index.localeCompare(b.$index))
    values.forEach(row => {
      const id = row.$id
      map.set(id, Value.toY(row))
    })
    return map
  }
  export function fromY<T>(map: Y.Map<T>) {
    const values = []
    for (const key of map.keys()) {
      if (key !== '$type') values.push(Value.fromY(map.get(key)))
    }
    values.sort((a, b) => a.$index.localeCompare(b.$index))
    return values
  }
  export function mutator<T extends Row>(
    parent: Y.Map<any>,
    key: string
  ): Mutator<T> {
    return {
      push: (row: T) => {
        const record = parent.get(key)
        record.set(row.$id, Value.toY(row))
      },
      delete: (id: string) => {
        const record = parent.get(key)
        record.delete(id)
      }
    }
  }
}
