import {LinkResolver} from 'alinea/backend/resolver/LinkResolver'
import * as Y from 'yjs'
import {createId} from '../Id.js'
import {Label} from '../Label.js'
import {Shape} from '../Shape.js'
import {PostProcess} from '../pages/PostProcess.js'
import {generateKeyBetween} from '../util/FractionalIndexing.js'
import {RecordShape} from './RecordShape.js'
import {ScalarShape} from './ScalarShape.js'

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

export class ListShape<T extends ListRow>
  implements Shape<Array<T>, ListMutator<T>>
{
  values: Record<string, RecordShape>
  constructor(
    public label: Label,
    public shapes: Record<string, RecordShape>,
    public initialValue?: Array<T>,
    protected postProcess?: PostProcess<Array<T>>
  ) {
    this.values = Object.fromEntries(
      Object.entries(shapes).map(([key, type]) => {
        return [
          key,
          new RecordShape(label, {
            id: new ScalarShape('Id'),
            index: new ScalarShape('Index'),
            type: new ScalarShape('Type'),
            ...type.properties
          })
        ]
      })
    )
  }
  create() {
    return this.initialValue ?? ([] as Array<T>)
  }
  toY(value: Array<T>) {
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
  fromY(map: Y.Map<any>): Array<T> {
    const rows: Array<T> = []
    if (!map || typeof map.keys !== 'function') return rows
    for (const key of map.keys()) {
      const row = map.get(key)
      if (!row || typeof row.get !== 'function') continue
      const type = row.get('type')
      const rowType = this.values[type]
      if (rowType) rows.push(rowType.fromY(row) as T)
    }
    rows.sort(sort)
    return rows
  }
  applyY(value: T[], parent: Y.Map<any>, key: string): void {
    if (!Array.isArray(value)) return
    const current: Y.Map<any> | undefined = parent.get(key)
    if (!current) return void parent.set(key, this.toY(value))
    const currentKeys = new Set(current.keys())
    const valueKeys = new Set(value.map(row => row.id))
    const removed = [...currentKeys].filter(key => !valueKeys.has(key))
    const added = [...valueKeys].filter(key => !currentKeys.has(key))
    const changed = [...valueKeys].filter(key => currentKeys.has(key))
    for (const id of removed) current.delete(id)
    for (const id of added) {
      const row = value.find(row => row.id === id)
      if (!row) continue
      const type = row.type
      const rowType = this.values[type]
      if (!rowType) continue
      current.set(id, rowType.toY(row))
    }
    for (const id of changed) {
      const row = value.find(row => row.id === id)
      if (!row) continue
      const type = row.type
      const currentRow = current.get(id)
      if (!currentRow) continue
      const currentType = currentRow.get('type')
      // This shouldn't normally happen unless we manually change the type
      if (currentType !== type) {
        current.delete(id)
        current.set(id, this.values[type].toY(row))
        continue
      }
      const rowType = this.values[type]
      if (!rowType) continue
      rowType.applyY(row, current, id)
    }
  }
  init(parent: Y.Map<any>, key: string): void {
    if (!parent.has(key)) parent.set(key, this.toY(this.create()))
  }
  watch(parent: Y.Map<any>, key: string) {
    const map: Y.Map<any> = parent.get(key)
    return (fun: () => void) => {
      function w(events: Array<Y.YEvent<any>>, transaction: Y.Transaction) {
        for (const event of events) {
          if (event.target === map) fun()
          if (event instanceof Y.YMapEvent && event.keysChanged.has('index'))
            fun()
        }
      }
      map.observeDeep(w)
      return () => {
        map.unobserveDeep(w)
      }
    }
  }
  mutator(parent: Y.Map<any>, key: string) {
    const res = {
      replace: (id: string, row: T) => {
        const record = parent.get(key)
        const rows: Array<ListRow> = this.fromY(record) as any
        const index = rows.findIndex(r => r.id === id)
        res.remove(id)
        res.push(row, index)
      },
      push: (row: Omit<T, 'id' | 'index'>, insertAt?: number) => {
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
  async applyLinks(value: Array<T>, loader: LinkResolver) {
    const tasks = []
    if (!Array.isArray(value)) return
    for (const row of value) {
      const type = row.type
      const shape = this.values[type]
      if (shape) tasks.push(shape.applyLinks(row, loader))
    }
    await Promise.all(tasks)
    if (this.postProcess) await this.postProcess(value, loader)
  }

  searchableText(value: Array<T>): string {
    let res = ''
    const rows = Array.isArray(value) ? value : []
    for (const row of rows) {
      const id = row.id
      const type = row.type
      const shape = this.values[type]
      if (!id || !type || !shape) continue
      res += shape.searchableText(row)
    }
    return res
  }
}
