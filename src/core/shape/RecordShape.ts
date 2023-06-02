import * as Y from 'yjs'
import {Label} from '../Label.js'
import {Shape} from '../Shape.js'
import {create, entries} from '../util/Objects.js'

export type RecordMutator<T> = {
  set: <K extends keyof T>(k: K, v: T[K]) => void
}

export class RecordShape<T = {}> implements Shape<T, RecordMutator<T>> {
  constructor(
    public label: Label,
    public properties: Record<string, Shape>,
    public initialValue?: T
  ) {}
  innerTypes(parents: Array<string>) {
    return entries(this.properties).flatMap(([name, shape]) => {
      return shape.innerTypes(parents.concat(name))
    })
  }
  concat<X>(that: RecordShape<X> | undefined): RecordShape<T & X> {
    if (!that) return this as any
    return new RecordShape<T & X>(that.label, {
      ...this.properties,
      ...that.properties
    })
  }
  create() {
    return (
      this.initialValue ||
      (Object.fromEntries(
        Object.entries(this.properties).map(([key, field]) => {
          return [key, field.create()]
        })
      ) as T)
    )
  }
  typeOfChild<C>(yValue: T, child: string): Shape<C> {
    return this.properties[child]
  }
  toY(value: T) {
    const self: Record<string, any> = value || {}
    const map = new Y.Map()
    for (const key of Object.keys(this.properties)) {
      map.set(key, this.properties[key].toY(self[key]))
    }
    return map
  }
  fromY(map: Y.Map<any>) {
    const res: Record<string, any> = create(null)
    for (const key of Object.keys(this.properties)) {
      res[key] = this.properties[key].fromY(map?.get(key))
    }
    return res as T
  }
  watch(parent: Y.Map<any>, key: string) {
    return (fun: () => void) => {
      const record = parent.get(key)
      record.observe(fun)
      return () => record.unobserve(fun)
    }
  }
  mutator(parent: Y.Map<any>, key: string) {
    return {
      set: <K extends keyof T>(k: K, v: T[K]) => {
        const record = parent.get(key)
        const field = this.properties[k as string]
        record.set(key, field.toY(v))
      }
    }
  }
  extractLinks(path: Array<string>, value: any) {
    if (!value || typeof value !== 'object') return []
    return [
      ...entries(this.properties).flatMap(([key, shape]) => {
        return shape.extractLinks(path.concat(key), value[key])
      })
    ]
  }
  /*valueToStorage(value: T): T {
    const obj: Record<string, any> = value || {}
    if (typeof obj !== 'object') return {} as T
    return fromEntries(
      entries(this.properties).map(([key, shape]) => {
        return [key, shape.valueToStorage(obj[key])]
      })
    ) as T
  }
  storageToValue(stored: T): T {
    const obj: Record<string, any> = stored || {}
    if (typeof obj !== 'object') return {} as T
    return fromEntries(
      entries(this.properties).map(([key, shape]) => {
        return [key, shape.storageToValue(obj[key])]
      })
    ) as T
  }
  selectFromStorage(expr: Expr<T>): Expr<T> {
    return new Expr(
      new ExprData.Record(
        fromEntries(
          entries(this.properties).map(([key, shape]) => {
            return [key, shape.selectFromStorage(expr.get(key))[Expr.Data]]
          })
        )
      )
    )
  }
  selectedToValue(selected: T): T {
    const obj: Record<string, any> = selected || {}
    if (typeof obj !== 'object') return {} as T
    return fromEntries(
      entries(this.properties).map(([key, shape]) => {
        return [key, shape.selectedToValue(obj[key])]
      })
    ) as T
  }*/
}
