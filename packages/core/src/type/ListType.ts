import {generateKeyBetween} from 'fractional-indexing'
import * as Y from 'yjs'
import {createId} from '../Id'
import {Type} from '../Type'
import {RecordType} from './RecordType'

type Row = {
  $id: string
  $index: string
  $channel: string
}

/*
  export type Mutator<T extends Row> = {
    push: (row: Omit<T, '$id' | '$index'>) => void
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
export class ListType<T> implements Type<Array<Row & T>> {
  types: Record<string, RecordType<Row & T>>
  constructor(shapes: Record<string, RecordType<T>>) {
    this.types = Object.fromEntries(
      Object.entries(shapes).map(([key, type]) => {
        return [
          key,
          new RecordType({
            $id: Type.Scalar,
            $index: Type.Scalar,
            $channel: Type.Scalar,
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
      const id = row.$id
      const channel = row.$channel
      const type = this.types[channel]
      if (!id || !channel || !type) continue
      currentIndex = generateKeyBetween(currentIndex, null)
      map.set(id, type.toY({...row, $index: currentIndex}))
    }
    return map
  }
  fromY(map: Y.Map<any>): Array<Row & T> {
    const rows = []
    for (const key of map.keys()) {
      const row = map.get(key)
      const channel = row.get('$channel')
      rows.push(this.types[channel].fromY(row) as Row & T)
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
      push: (row: Omit<T, '$id' | '$index'>) => {
        const record = parent.get(key)
        const rows: Array<Row> = this.fromY(record) as any
        const id = createId()
        record.set(
          id,
          this.types[row.$channel].toY({
            ...row,
            $id: id,
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
