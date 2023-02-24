import * as Y from 'yjs'
import {createError} from '../ErrorWithCode.js'
import {Hint} from '../Hint.js'
import {createId} from '../Id.js'
import {Label} from '../Label.js'
import {Shape, ShapeInfo} from '../Shape.js'
import {generateKeyBetween} from '../util/FractionalIndexing.js'
import {RecordShape} from './RecordShape.js'

export type ListRow = {
  id: string
  index: string
  type: string
}

function sort(a: ListRow, b: ListRow) {
  if (a.index < b.index) return -1
  if (a.index > b.index) return 1
  return 0
}

export type ListMutator<T> = {
  replace: (id: string, row: T) => void
  push: (row: Omit<T, 'id' | 'index'>, insertAt?: number) => void
  remove: (id: string) => void
  move: (oldIndex: number, newIndex: number) => void
}

export class ListShape<T>
  implements Shape<Array<ListRow & T>, ListMutator<ListRow & T>>
{
  values: Record<string, RecordShape>
  constructor(
    public label: Label,
    public shapes: Record<string, RecordShape>,
    public initialValue?: Array<ListRow & T>
  ) {
    this.values = Object.fromEntries(
      Object.entries(shapes).map(([key, type]) => {
        return [
          key,
          new RecordShape(label, {
            id: Shape.Scalar('Id'),
            index: Shape.Scalar('Index'),
            type: Shape.Scalar('Type'),
            ...type.properties
          })
        ]
      })
    )
  }
  innerTypes(parents: Array<string>): Array<ShapeInfo> {
    return Object.entries(this.shapes).flatMap(([name, shape]) => {
      const info = {name, shape, parents}
      const inner = shape.innerTypes(parents.concat(name))
      if (Hint.isDefinitionName(name)) return [info, ...inner]
      return inner
    })
  }
  create() {
    return this.initialValue || ([] as Array<ListRow & T>)
  }
  typeOfChild<C>(yValue: Y.Map<any>, child: string): Shape<C> {
    const row = yValue.get(child)
    const type = row && row.get('type')
    const value = type && this.values[type]
    if (value) return value as unknown as Shape<C>
    throw createError(`Could not determine type of child "${child}"`)
  }
  toY(value: Array<ListRow & T>) {
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
  fromY(map: Y.Map<any>): Array<ListRow & T> {
    const rows: Array<ListRow & T> = []
    if (!map) return rows
    for (const key of map.keys()) {
      const row = map.get(key)
      if (!row || typeof row.get !== 'function') continue
      const type = row.get('type')
      const rowType = this.values[type]
      if (rowType) rows.push(rowType.fromY(row) as ListRow & T)
    }
    rows.sort(sort)
    return rows
  }
  watch(parent: Y.Map<any>, key: string) {
    const record: Y.Map<any> = parent.has(key)
      ? parent.get(key)
      : parent.set(key, new Y.Map())
    return (fun: () => void) => {
      function w(events: Array<Y.YEvent<any>>, transaction: Y.Transaction) {
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
    const res = {
      replace: (id: string, row: ListRow & T) => {
        const record = parent.get(key)
        const rows: Array<ListRow> = this.fromY(record) as any
        const index = rows.findIndex(r => r.id === id)
        res.remove(id)
        res.push(row, index)
      },
      push: (row: Omit<ListRow & T, 'id' | 'index'>, insertAt?: number) => {
        const type = row.type
        const shape = this.values[type]
        const record = parent.get(key)
        const rows: Array<ListRow> = this.fromY(record) as any
        const id = createId()
        const before = insertAt === undefined ? rows.length - 1 : insertAt - 1
        const after = before + 1
        const keyA = rows[before]?.index || null
        const keyB = rows[after]?.index || null
        const item = shape.toY({
          ...shape.create(),
          ...row,
          id,
          index: generateKeyBetween(keyA, keyB)
        })
        record.set(id, item)
      },
      remove(id: string) {
        const record = parent.get(key)
        record.delete(id)
      },
      move: (oldIndex: number, newIndex: number) => {
        const record = parent.get(key)
        const rows: Array<ListRow> = this.fromY(record) as any
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
    return res
  }
}
