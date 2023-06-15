import * as Y from 'yjs'
import {Label} from '../Label.js'
import {Shape} from '../Shape.js'

export type ScalarMutator<T> = (value: T) => void

export class ScalarShape<T> implements Shape<T, ScalarMutator<T>> {
  constructor(public label: Label, private initialValue?: T) {}
  innerTypes() {
    return []
  }
  create(): T {
    return this.initialValue as T
  }
  typeOfChild<C>(yValue: T, child: string): Shape<C> {
    throw new Error(`No children in scalar values`)
  }
  toY(value: T) {
    return value
  }
  fromY(yValue: any) {
    return yValue
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
}
