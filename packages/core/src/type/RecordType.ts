import * as Y from 'yjs'
import {Type} from '../Type'

export class RecordType<T extends Record<string, any> = {}> implements Type<T> {
  constructor(public shape: Record<string, Type>) {}
  toY(value: T) {
    const map = new Y.Map()
    for (const key of Object.keys(this.shape)) {
      map.set(key, this.shape[key].toY(value[key]))
    }
    return map
  }
  fromY(map: Y.Map<any>) {
    const res: Record<string, any> = {}
    for (const key of Object.keys(this.shape)) {
      res[key] = this.shape[key].fromY(map.get(key))
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
  mutator<T>(parent: Y.Map<any>, key: string) {
    return {
      set: <K extends keyof T>(k: K, v: T[K]) => {
        const record = parent.get(key)
        const field = this.shape[k as string]
        record.set(key, field.toY(v))
      }
    }
  }
}
