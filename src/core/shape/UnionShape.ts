import {LinkResolver} from 'alinea/backend/resolver/LinkResolver'
import * as Y from 'yjs'
import {Hint} from '../Hint.js'
import {createId} from '../Id.js'
import {Label} from '../Label.js'
import {Shape, ShapeInfo} from '../Shape.js'
import {PostProcess} from '../pages/PostProcess.js'
import {entries, fromEntries} from '../util/Objects.js'
import {RecordShape} from './RecordShape.js'
import {ScalarShape} from './ScalarShape.js'

export type UnionRow = {
  id: string
  type: string
}

export type UnionMutator<T> = {
  replace: (v: (UnionRow & T) | undefined) => void
  set: <K extends keyof T>(k: K, v: T[K]) => void
}

export class UnionShape<T> implements Shape<UnionRow & T, UnionMutator<T>> {
  shapes: Record<string, RecordShape>
  constructor(
    public label: Label,
    shapes: Record<string, RecordShape>,
    public initialValue?: UnionRow & T,
    protected postProcess?: PostProcess<UnionRow & T>
  ) {
    this.shapes = fromEntries(
      entries(shapes).map(([key, type]) => {
        return [
          key,
          new RecordShape(label, {
            id: new ScalarShape('Id'),
            type: new ScalarShape('Type'),
            ...type.properties
          })
        ]
      })
    )
  }
  innerTypes(parents: Array<string>): Array<ShapeInfo> {
    return entries(this.shapes).flatMap(([name, shape]) => {
      const info = {name, shape, parents}
      const inner = shape.innerTypes(parents.concat(name))
      if (Hint.isDefinitionName(name)) return [info, ...inner]
      return inner
    })
  }
  create(): UnionRow & T {
    return this.initialValue || ({} as UnionRow & T)
  }
  typeOfChild<C>(yValue: Y.Map<any>, child: string): Shape<C> {
    const type = yValue && yValue.get('type')
    const shape = type && this.shapes[type]
    if (shape) return shape.typeOfChild(yValue, child)
    throw new Error(`Could not determine type of child "${child}"`)
  }
  toY(value: UnionRow & T) {
    if (Array.isArray(value)) value = value[0] ?? {}
    else value = value ?? {}
    const type = value.type
    const shape = this.shapes[type]
    const self: Record<string, any> = value || {}
    const map = new Y.Map()
    map.set('type', type)
    map.set('id', value.id || createId())
    if (!shape) return map
    for (const [key, field] of entries(shape.properties)) {
      map.set(key, field.toY(self[key]))
    }
    return map
  }
  fromY(map: Y.Map<any>): UnionRow & T {
    if (!map || typeof map.get !== 'function') return {} as UnionRow & T
    const type = map.get('type')
    const recordType = this.shapes[type]
    if (recordType) return recordType.fromY(map) as UnionRow & T
    return {} as UnionRow & T
  }
  applyY(value: UnionRow & T, parent: Y.Map<any>, key: string): void {
    const current: Y.Map<any> | undefined = parent.get(key)
    if (!current) return void parent.set(key, this.toY(value))
    const currentType = current.get('type')
    if (currentType !== value.type) return void parent.set(key, this.toY(value))
    const shape = this.shapes[currentType]
    if (!shape) return
    shape.applyY(value, parent, key)
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
      replace: (v: (UnionRow & T) | undefined) => {
        if (!v) parent.set(key, null)
        else parent.set(key, this.toY(v))
      },
      set: (k: any, v: any) => {
        const record = parent.get(key)
        const type = record.get('type')
        const shape = this.shapes[type]
        if (!shape) throw new Error(`Could not find type "${type}"`)
        record.set(k, shape.toY(v as object))
      }
    }
  }
  async applyLinks(value: UnionRow & T, loader: LinkResolver) {
    if (!value) return
    const type = value.type
    if (!type) return
    const shape = this.shapes[type]
    if (!shape) return
    const tasks = []
    if (shape) tasks.push(shape.applyLinks(value, loader))
    await Promise.all(tasks)
    if (this.postProcess) await this.postProcess(value, loader)
  }
}
