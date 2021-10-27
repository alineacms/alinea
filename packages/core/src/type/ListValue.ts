import {generateKeyBetween} from 'fractional-indexing'
import * as Y from 'yjs'
import {createId} from '../Id'
import {Value} from '../Value'
import {RecordValue} from './RecordValue'

type Row = {
  id: string
  $index: string
  $channel: string
}

/*
  export type Mutator<T extends Row> = {
    push: (row: Omit<T, 'id' | '$index'>) => void
    delete: (id: string) => void
    move: (oldIndex: number, newIndex: number) => void
  }
*/

function sort(a: Row, b: Row) {
  if (a.$index < b.$index) return -1
  if (a.$index > b.$index) return 1
  return 0
}

// Todo: might as well use Y.Array and just sort the array by $index
// in useInput. It would mean we don't have to store $type.
export class ListValue<T> implements Value<Array<Row & T>> {
  values: Record<string, RecordValue<Row & T>>
  constructor(shapes: Record<string, RecordValue<T>>) {
    this.values = Object.fromEntries(
      Object.entries(shapes).map(([key, type]) => {
        return [
          key,
          new RecordValue({
            id: Value.Scalar,
            $index: Value.Scalar,
            $channel: Value.Scalar,
            ...type.shape
          })
        ]
      })
    )
  }
  toY(value: Array<Row & T>) {
    const map = new Y.Map()
    const rows = Array.isArray(value) ? value : []
    let currentIndex = null
    for (const row of rows) {
      const id = row.id
      const type = row.$channel
      const valueType = this.values[type]
      if (!id || !type || !valueType) continue
      currentIndex = generateKeyBetween(currentIndex, null)
      map.set(id, valueType.toY({...row, $index: currentIndex}))
    }
    return map
  }
  fromY(map: Y.Map<any>): Array<Row & T> {
    const rows = []
    for (const key of map.keys()) {
      const row = map.get(key)
      const type = row.get('$channel')
      rows.push(this.values[type].fromY(row) as Row & T)
    }
    rows.sort(sort)
    return rows
  }
  watch(parent: Y.Map<any>, key: string) {
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
  mutator<T extends Row>(parent: Y.Map<any>, key: string) {
    return {
      push: (row: Omit<T, 'id' | '$index'>) => {
        const record = parent.get(key)
        const rows: Array<Row> = this.fromY(record) as any
        const id = createId()
        record.set(
          id,
          this.values[row.$channel].toY({
            ...row,
            id,
            $index: generateKeyBetween(
              rows[rows.length - 1]?.$index || null,
              null
            )
          } as any)
        )
      },
      delete(id: string) {
        const record = parent.get(key)
        record.delete(id)
      },
      move: (oldIndex: number, newIndex: number) => {
        const record = parent.get(key)
        const rows: Array<Row> = this.fromY(record) as any
        const from = rows[oldIndex]
        const into = rows.filter(row => row.id !== from.id)
        const prev = into[newIndex - 1]
        const next = into[newIndex]
        const a = prev?.$index || null
        const b = next?.$index || null
        const $index = generateKeyBetween(a, b)
        const row = record.get(from.id)
        row.set('$index', $index)
      }
    }
  }
}
