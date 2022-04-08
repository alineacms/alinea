import {generateKeyBetween} from '@alineacms/core/util/FractionalIndexing'
import * as Y from 'yjs'
import {createError} from '../ErrorWithCode'
import {createId} from '../Id'
import {Value} from '../Value'
import {RecordValue} from './RecordValue'

type Row = {
  id: string
  index: string
  type: string
}

function sort(a: Row, b: Row) {
  if (a.index < b.index) return -1
  if (a.index > b.index) return 1
  return 0
}

export type ListMutator<T> = {
  push: (row: Omit<T, 'id' | 'index'>) => void
  remove: (id: string) => void
  move: (oldIndex: number, newIndex: number) => void
}

export class ListValue<T>
  implements Value<Array<Row & T>, ListMutator<Row & T>>
{
  values: Record<string, RecordValue<Row & T>>
  constructor(shapes: Record<string, RecordValue<T>>) {
    this.values = Object.fromEntries(
      Object.entries(shapes).map(([key, type]) => {
        return [
          key,
          new RecordValue({
            id: Value.Scalar,
            index: Value.Scalar,
            type: Value.Scalar,
            ...type.shape
          })
        ]
      })
    )
  }
  create() {
    return [] as Array<Row & T>
  }
  typeOfChild<C>(yValue: Y.Map<any>, child: string): Value<C> {
    const row = yValue.get(child)
    const type = row && row.get('type')
    const value = type && this.values[type]
    if (value) return value as unknown as Value<C>
    throw createError(`Could not determine type of child "${child}"`)
  }
  toY(value: Array<Row & T>) {
    const map = new Y.Map()
    const rows = Array.isArray(value) ? value : []
    let currentIndex = null
    for (const row of rows) {
      const id = row.id
      const type = row.type
      const valueType = this.values[type]
      if (!id || !type || !valueType) continue
      currentIndex = generateKeyBetween(currentIndex, null)
      map.set(id, valueType.toY({...row, index: currentIndex}))
    }
    return map
  }
  fromY(map: Y.Map<any>): Array<Row & T> {
    const rows: Array<Row & T> = []
    if (!map) return rows
    for (const key of map.keys()) {
      const row = map.get(key)
      if (!row || typeof row.get !== 'function') continue
      const type = row.get('type')
      const rowType = this.values[type]
      if (rowType) rows.push(rowType.fromY(row) as Row & T)
    }
    rows.sort(sort)
    return rows
  }
  watch(parent: Y.Map<any>, key: string) {
    const record: Y.Map<any> = parent.has(key)
      ? parent.get(key)
      : parent.set(key, new Y.Map())
    return (fun: () => void) => {
      function w(events: Array<Y.YEvent>, transaction: Y.Transaction) {
        for (const event of events) {
          if (event.target === record) fun()
          if (event instanceof Y.YMapEvent && event.keysChanged.has('index'))
            fun()
        }
      }
      record.observeDeep(w)
      return () => {
        record.unobserveDeep(w)
      }
    }
  }
  mutator(parent: Y.Map<any>, key: string) {
    return {
      push: (row: Omit<Row & T, 'id' | 'index'>) => {
        const record = parent.get(key)
        const rows: Array<Row> = this.fromY(record) as any
        const id = createId()
        record.set(
          id,
          this.values[row.type].toY({
            ...row,
            id,
            index: generateKeyBetween(
              rows[rows.length - 1]?.index || null,
              null
            )
          } as any)
        )
      },
      remove(id: string) {
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
        const a = prev?.index || null
        const b = next?.index || null
        const index = generateKeyBetween(a, b)
        const row = record.get(from.id)
        row.set('index', index)
      }
    }
  }
}
