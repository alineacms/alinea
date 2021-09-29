import {generateKeyBetween} from 'fractional-indexing'
import * as Y from 'yjs'
import {createId} from '..'
import {Value} from './Value'

export type ListValue<T> = Array<ListValue.Row>

export namespace ListValue {
  export type Row = {
    $id: string
    $index: string
    $channel: string
  }
  export type Mutator<T extends Row> = {
    push: (row: Omit<T, '$id' | '$index'>) => void
    delete: (id: string) => void
    move: (oldIndex: number, newIndex: number) => void
  }
  function sort(a: Row, b: Row) {
    if (a.$index < b.$index) return -1
    if (a.$index > b.$index) return 1
    return 0
  }
  export function toY<T>(value: ListValue<T>) {
    const map = new Y.Map()
    map.set('$type', Value.List)
    const values = value.filter(row => Boolean(row.$index))
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
    values.sort(sort)
    return values
  }
  export function watch(parent: Y.Map<any>, key: string) {
    const record: Y.Map<any> = parent.get(key)
    return (fun: () => void) => {
      function w(events: Array<Y.YEvent>, transaction: Y.Transaction) {
        for (const event of events) {
          if (event.target === record) fun()
          if (event instanceof Y.YMapEvent && event.keysChanged.has('$index'))
            fun()
        }
      }
      record.observeDeep(w)
      return () => {
        record.unobserveDeep(w)
      }
    }
  }
  export function mutator<T extends Row>(
    parent: Y.Map<any>,
    key: string
  ): Mutator<T> {
    return {
      push(row: Omit<T, '$id' | '$index'>) {
        const record = parent.get(key)
        const rows = fromY(record)
        const id = createId()
        record.set(
          id,
          Value.toY({
            ...row,
            $id: id,
            $index: generateKeyBetween(
              rows[rows.length - 1]?.$index || null,
              null
            )
          })
        )
      },
      delete(id: string) {
        const record = parent.get(key)
        record.delete(id)
      },
      move(oldIndex: number, newIndex: number) {
        const record = parent.get(key)
        const rows = fromY(record)
        const from = rows[oldIndex]
        const into = rows.filter(row => row.$id !== from.$id)
        const prev = into[newIndex - 1]
        const next = into[newIndex]
        const a = prev?.$index || null
        const b = next?.$index || null
        const $index = generateKeyBetween(a, b)
        const row = record.get(from.$id)
        row.set('$index', $index)
      }
    }
  }
}
