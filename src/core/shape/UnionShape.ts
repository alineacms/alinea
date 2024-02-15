import {LinkResolver} from 'alinea/backend/resolver/LinkResolver'
import * as Y from 'yjs'
import {createId} from '../Id.js'
import {Label} from '../Label.js'
import {Shape} from '../Shape.js'
import {PostProcess} from '../pages/PostProcess.js'
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
  set: <K extends keyof T>(k: K, v: T[K]) => void
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
      const observe = (event: Y.YMapEvent<any>) => {
        if (event.keysChanged.has(key)) fun()
      }
      parent.observe(observe)
      return () => parent.unobserve(observe)
    }
  }
  mutator(parent: Y.Map<any>, key: string): UnionMutator<T> {
    return {
      replace: (v: T | undefined) => {
        if (!v) parent.set(key, null)
        else parent.set(key, this.toY(v))
      },
      set: (k: any, v: any) => {
        const record = parent.get(key)
        const type = record.get(UnionRow.type)
        const shape = this.shapes[type]
        if (!shape) throw new Error(`Could not find type "${type}"`)
        record.set(k, shape.toY(v as object))
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

  normalize(value: any): T {
    if (Array.isArray(value)) value = value[0] ?? {}
    if (!value) return {} as T
    if (UnionRow.type in value) return value
    const {id, type, ...data} = value as any
    if (!id || !type) return {} as T
    const shape = this.shapes[type]
    return {
      ...shape.normalize(data),
      [UnionRow.type]: type,
      [UnionRow.id]: id
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
