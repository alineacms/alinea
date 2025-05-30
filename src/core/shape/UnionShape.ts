import type {LinkResolver} from 'alinea/core/db/LinkResolver'
import * as Y from 'yjs'
import {createId} from '../Id.js'
import type {Label} from '../Label.js'
import type {Shape} from '../Shape.js'
import type {PostProcess} from '../pages/PostProcess.js'
import {entries, fromEntries} from '../util/Objects.js'
import {RecordShape} from './RecordShape.js'
import {ScalarShape} from './ScalarShape.js'

export interface UnionRow {
  _id: string
  _type: string
}

export namespace UnionRow {
  export const id = '_id' satisfies keyof UnionRow
  export const type = '_type' satisfies keyof UnionRow
}

export interface UnionMutator<T extends UnionRow> {
  replace: (v: T | undefined) => void
}

export class UnionShape<T extends UnionRow>
  implements Shape<T, UnionMutator<T>>
{
  shapes: Record<string, RecordShape>
  constructor(
    public label: Label,
    shapes: Record<string, RecordShape>,
    public initialValue?: T,
    protected postProcess?: PostProcess<T>
  ) {
    this.shapes = fromEntries(
      entries(shapes).map(([key, type]) => {
        return [
          key,
          new RecordShape(label, {
            [UnionRow.id]: new ScalarShape('Id'),
            [UnionRow.type]: new ScalarShape('Type'),
            ...type.shapes
          })
        ]
      })
    )
  }
  create(): T {
    return this.initialValue ?? ({} as T)
  }
  toY(value: T) {
    if (Array.isArray(value)) value = value[0] ?? {}
    else value = value ?? {}
    const type = value[UnionRow.type]
    const shape = this.shapes[type]
    const self: Record<string, any> = value || {}
    const map = new Y.Map()
    map.set(UnionRow.type, type)
    map.set(UnionRow.id, value[UnionRow.id] || createId())
    if (!shape) return map
    for (const [key, field] of entries(shape.shapes)) {
      map.set(key, field.toY(self[key]))
    }
    return map
  }
  fromY(map: Y.Map<any>): T {
    if (!map || typeof map.get !== 'function') return {} as T
    const type = map.get(UnionRow.type)
    const recordType = this.shapes[type]
    if (recordType) return recordType.fromY(map) as T
    return {} as T
  }
  applyY(value: T, parent: Y.Map<any>, key: string): void {
    const current: Y.Map<any> | undefined = parent.get(key)
    if (!current || !value) return void parent.set(key, this.toY(value))
    const currentType = current.get(UnionRow.type)
    if (currentType !== value[UnionRow.type])
      return void parent.set(key, this.toY(value))
    const shape = this.shapes[currentType]
    if (!shape) return
    shape.applyY(value, parent, key)
  }
  init(parent: Y.Map<any>, key: string): void {
    if (!parent.has(key)) parent.set(key, this.toY(this.create()))
  }
  watch(parent: Y.Map<any>, key: string) {
    return (fun: () => void) => {
      const observe = (events: Array<Y.YEvent<any>>, tx: Y.Transaction) => {
        if (tx.origin === 'self') return
        const self = parent.get(key)
        for (const event of events) {
          if (event.target === parent && event.keys.has(key)) return fun()
          if (event.target === self) return fun()
        }
      }
      parent.observeDeep(observe)
      return () => parent.unobserveDeep(observe)
    }
  }
  mutator(parent: Y.Map<any>, key: string): UnionMutator<T> {
    return {
      replace: (value: T | undefined) => {
        if (!value) return parent.set(key, null)
        const type = value[UnionRow.type]
        const shape = this.shapes[type]
        if (!shape) throw new Error(`Could not find type "${type}"`)
        shape.applyY(value, parent, key)
      }
    }
  }
  async applyLinks(value: T, loader: LinkResolver) {
    if (!value) return
    const type = value[UnionRow.type]
    if (!type) return
    const shape = this.shapes[type]
    if (!shape) return
    const tasks = []
    if (shape) tasks.push(shape.applyLinks(value, loader))
    await Promise.all(tasks)
    if (this.postProcess) await this.postProcess(value, loader)
  }

  toV1(value: any): T {
    if (Array.isArray(value)) value = value[0] ?? {}
    if (!value) return {} as T
    if (UnionRow.type in value) return value
    const {id, type, ...data} = value as any
    if (!id || !type) return {} as T
    const shape = this.shapes[type]
    if (!shape) return {} as T
    return {
      [UnionRow.type]: type,
      [UnionRow.id]: id,
      ...shape.toV1(data)
    } as T
  }

  searchableText(value: T): string {
    let res = ''
    if (Array.isArray(value)) value = value[0] ?? {}
    else value = value ?? {}
    const type = value[UnionRow.type]
    const shape = this.shapes[type]
    const self: Record<string, any> = value || {}
    if (!shape) return ''
    for (const [key, field] of entries(shape.shapes)) {
      res += field.searchableText(self[key])
    }
    return res
  }
}
