import {LinkResolver} from 'alinea/backend/resolver/LinkResolver'
import * as Y from 'yjs'
import {createId} from '../Id.js'
import {Label} from '../Label.js'
import {Shape} from '../Shape.js'
import {PostProcess} from '../pages/PostProcess.js'
import {generateKeyBetween} from '../util/FractionalIndexing.js'
import {RecordShape} from './RecordShape.js'
import {ScalarShape} from './ScalarShape.js'

// Todo: there's overlap between this and UnionShape. Can we merge them?

export interface ListRow {
  _id: string
  _type: string
  _index: string
}

export namespace ListRow {
  export const id = '_id' satisfies keyof ListRow
  export const index = '_index' satisfies keyof ListRow
  export const type = '_type' satisfies keyof ListRow
}

function sort(a: ListRow, b: ListRow) {
  if (a[ListRow.index] < b[ListRow.index]) return -1
  if (a[ListRow.index] > b[ListRow.index]) return 1
  return 0
}

export interface ListMutator<Row> {
  replace(id: string, row: Row): void
  push(row: Omit<Row, '_id' | '_index'>, insertAt?: number): void
  remove(id: string): void
  move(oldIndex: number, newIndex: number): void
}

export class ListShape<Row extends ListRow>
  implements Shape<Array<Row>, ListMutator<Row>>
{
  shapes: Record<string, RecordShape>
  constructor(
    public label: Label,
    shapes: Record<string, RecordShape>,
    public initialValue?: Array<Row>,
    protected postProcess?: PostProcess<Array<Row>>
  ) {
    this.shapes = Object.fromEntries(
      Object.entries(shapes).map(([key, type]) => {
        return [
          key,
          new RecordShape(label, {
            [ListRow.id]: new ScalarShape('Id'),
            [ListRow.index]: new ScalarShape('Index'),
            [ListRow.type]: new ScalarShape('Type'),
            ...type.shapes
          })
        ]
      })
    )
  }
  create() {
    return this.initialValue ?? ([] as Array<Row>)
  }
  toV1(value: any) {
    if (!Array.isArray(value)) return []
    return value.map(this.normalizeRow).filter(Boolean) as Array<Row>
  }
  private normalizeRow = (row: Row): Row | undefined => {
    if (ListRow.type in row) return row
    const {id, type, index, ...data} = row as any
    if (!id || !type) return undefined
    const shape = this.shapes[type]
    const updated = shape.toV1(data)
    return {
      [ListRow.type]: type,
      [ListRow.id]: id,
      [ListRow.index]: index,
      ...updated
    } as Row
  }
  toY(value: Array<Row>) {
    const map = new Y.Map()
    const rows = Array.isArray(value) ? value : []
    let currentIndex = null
    for (const row of rows) {
      const type = this.shapes[row[ListRow.type]]
      currentIndex = generateKeyBetween(currentIndex, null)
      map.set(
        row[ListRow.id],
        type.toY({...row, [ListRow.index]: currentIndex})
      )
    }
    return map
  }
  fromY(map: Y.Map<any>): Array<Row> {
    const rows: Array<Row> = []
    if (!map || typeof map.keys !== 'function') return rows
    for (const key of map.keys()) {
      const row = map.get(key)
      if (!row || typeof row.get !== 'function') continue
      const type = row.get(ListRow.type)
      const rowType = this.shapes[type]
      if (rowType) rows.push(rowType.fromY(row) as Row)
    }
    rows.sort(sort)
    return rows
  }
  applyY(value: Row[], parent: Y.Map<any>, key: string): void {
    if (!Array.isArray(value)) return
    const current: Y.Map<any> | undefined = parent.get(key)
    if (!current) return void parent.set(key, this.toY(value))
    const currentKeys = new Set(current.keys())
    const valueKeys = new Set(value.map(row => row[ListRow.id]))
    const removed = [...currentKeys].filter(key => !valueKeys.has(key))
    const added = [...valueKeys].filter(key => !currentKeys.has(key))
    const changed = [...valueKeys].filter(key => currentKeys.has(key))
    for (const id of removed) current.delete(id)
    for (const id of added) {
      const row = value.find(row => row[ListRow.id] === id)
      if (!row) continue
      const type = row[ListRow.type]
      const rowType = this.shapes[type]
      if (!rowType) continue
      current.set(id, rowType.toY(row))
    }
    for (const id of changed) {
      const row = value.find(row => row[ListRow.id] === id)
      if (!row) continue
      const type = row[ListRow.type]
      const currentRow = current.get(id)
      if (!currentRow) continue
      const currentType = currentRow.get(ListRow.type)
      // This shouldn't normally happen unless we manually change the type
      if (currentType !== type) {
        current.delete(id)
        current.set(id, this.shapes[type].toY(row))
        continue
      }
      const rowType = this.shapes[type]
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
          if (
            event instanceof Y.YMapEvent &&
            event.keysChanged.has(ListRow.index)
          )
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
      replace: (id: string, row: Row) => {
        const record = parent.get(key)
        const rows: Array<ListRow> = this.fromY(record) as any
        const index = rows.findIndex(r => r[ListRow.id] === id)
        res.remove(id)
        res.push(row, index)
      },
      push: (row: Omit<Row, '_id' | '_index'>, insertAt?: number) => {
        const type = row[ListRow.type]
        const shape = this.shapes[type]
        const record = parent.get(key)
        const rows: Array<ListRow> = this.fromY(record) as any
        const id = createId()
        const before = insertAt === undefined ? rows.length - 1 : insertAt - 1
        const after = before + 1
        const keyA = rows[before]?.[ListRow.index] || null
        const keyB = rows[after]?.[ListRow.index] || null
        const item = shape.toY({
          ...shape.create(),
          ...row,
          [ListRow.id]: id,
          [ListRow.index]: generateKeyBetween(keyA, keyB)
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
        const into = rows.filter(row => row[ListRow.id] !== from[ListRow.id])
        const prev = into[newIndex - 1]
        const next = into[newIndex]
        const a = prev?.[ListRow.index] || null
        const b = next?.[ListRow.index] || null
        const index = generateKeyBetween(a, b)
        const row = record.get(from[ListRow.id])
        row.set(ListRow.index, index)
      }
    }
    return res
  }
  async applyLinks(value: Array<Row>, loader: LinkResolver) {
    const tasks = []
    if (!Array.isArray(value)) return
    for (const row of value) {
      const type = row[ListRow.type]
      const shape = this.shapes[type]
      if (shape) tasks.push(shape.applyLinks(row, loader))
    }
    await Promise.all(tasks)
    if (this.postProcess) await this.postProcess(value, loader)
  }

  searchableText(value: Array<Row>): string {
    let res = ''
    const rows = Array.isArray(value) ? value : []
    for (const row of rows) {
      const id = row[ListRow.id]
      const type = row[ListRow.type]
      const shape = this.shapes[type]
      if (!id || !type || !shape) continue
      res += shape.searchableText(row)
    }
    return res
  }
}
