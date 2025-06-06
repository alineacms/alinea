import type * as Y from 'yjs'
import type {Label} from '../Label.js'
import type {Shape} from '../Shape.js'

export type ScalarMutator<T> = (value: T) => void

export class ScalarShape<T> implements Shape<T, ScalarMutator<T>> {
  constructor(
    public label: Label,
    public initialValue?: T,
    public searchable?: boolean
  ) {}
  create(): T {
    return this.initialValue as T
  }
  toY(value: T) {
    return value
  }
  toV1(value: any): T {
    return value
  }
  fromY(yValue: any) {
    return yValue
  }
  applyY(value: T, parent: Y.Map<any>, key: string): void {
    const current = parent.get(key)
    if (current !== value) parent.set(key, value)
  }
  init(parent: Y.Map<any>, key: string): void {
    if (!parent.has(key)) parent.set(key, this.toY(this.create()))
  }
  watch(parent: Y.Map<any>, key: string) {
    return (fun: () => void) => {
      function w(event: Y.YMapEvent<any>) {
        if (event.keysChanged.has(key)) fun()
      }
      parent.observe(w)
      return () => parent.unobserve(w)
    }
  }
  mutator(parent: Y.Map<any>, key: string) {
    return (value: T) => {
      parent.set(key, value)
    }
  }
  async applyLinks() {}
  searchableText(value: T): string {
    if (!this.searchable) return ''
    const stringified = String(value ?? '')
    return stringified ? ` ${stringified}` : ''
  }
}
