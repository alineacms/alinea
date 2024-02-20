import {LinkResolver} from 'alinea/backend/resolver/LinkResolver'
import * as Y from 'yjs'
import {Label} from '../Label.js'
import {Shape} from '../Shape.js'
import {entries, keys} from '../util/Objects.js'

export type RecordMutator<T> = {
  set: <K extends keyof T>(k: K, v: T[K]) => void
}

export class RecordShape<T = {}> implements Shape<T, RecordMutator<T>> {
  constructor(
    public label: Label,
    public shapes: Record<string, Shape>,
    public initialValue?: T
  ) {}
  concat<X>(that: RecordShape<X> | undefined): RecordShape<T & X> {
    if (!that) return this as any
    return new RecordShape<T & X>(that.label, {
      ...this.shapes,
      ...that.shapes
    })
  }
  create() {
    return (
      this.initialValue ??
      (Object.fromEntries(
        Object.entries(this.shapes).map(([key, field]) => {
          return [key, field.create()]
        })
      ) as T)
    )
  }
  toY(value: T) {
    const self: Record<string, any> = value || {}
    const map = new Y.Map()
    for (const key of keys(this.shapes)) {
      map.set(key, this.shapes[key].toY(self[key]))
    }
    return map
  }
  fromY(map: Y.Map<any>) {
    const res: Record<string, any> = {}
    for (const key of keys(this.shapes)) {
      res[key] = this.shapes[key].fromY(map?.get(key))
    }
    return res as T
  }
  applyY(value: T, map: Y.Doc | Y.Map<any>, key: string) {
    const current: Y.Map<any> | undefined =
      'getMap' in map ? map.getMap(key) : map.get(key)
    if (!current) return void (map as Y.Map<any>).set(key, this.toY(value))
    const self: Record<string, any> = value ?? {}
    for (const key of keys(this.shapes)) {
      this.shapes[key].init(current, key)
      if (key in self) this.shapes[key].applyY(self[key], current, key)
    }
  }
  init(parent: Y.Map<any>, key: string): void {
    if (!parent.has(key)) parent.set(key, this.toY(this.create()))
  }
  watch(parent: Y.Map<any>, key: string) {
    return (fun: () => void) => {
      const record = !key ? parent : parent.get(key)
      record.observe(fun)
      return () => record.unobserve(fun)
    }
  }
  mutator(parent: Y.Map<any>, key: string) {
    return {
      set: <K extends keyof T>(k: K, v: T[K]) => {
        const record = parent.get(key)
        const field = this.shapes[k as string]
        record.set(k, field.toY(v))
      }
    }
  }
  async applyLinks(value: T, loader: LinkResolver) {
    const obj: Record<string, any> = value || {}
    const tasks = []
    for (const [key, shape] of entries(this.shapes)) {
      tasks.push(shape.applyLinks(obj[key], loader))
    }
    await Promise.all(tasks)
  }

  toV1(value: any): T {
    const self: Record<string, any> = value || {}
    const res: Record<string, any> = {}
    for (const key of keys(this.shapes)) {
      const isUnderscored = key.startsWith('_')
      const oldValue = isUnderscored ? self[key.slice(1)] : self[key]
      const value = self[key] ?? oldValue
      res[key] = this.shapes[key].toV1(value)
    }
    return res as T
  }

  searchableText(value: T): string {
    let res = ''
    const self: Record<string, any> = value || {}
    for (const key of keys(this.shapes)) {
      res += this.shapes[key].searchableText(self[key])
    }
    return res
  }
}
