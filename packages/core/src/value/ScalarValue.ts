import * as Y from 'yjs'

export type ScalarValue<T> = T

export namespace ScalarValue {
  export type Mutator<T> = (item: T) => void
  export function toY<T>(value: ScalarValue<T>) {
    return value
  }
  export function fromY<T>(value: T) {
    return value
  }
  export function watch(parent: Y.Map<any>, key: string) {
    return (fun: () => void) => {
      function w(event: Y.YMapEvent<any>) {
        if (event.keysChanged.has(key)) fun()
      }
      parent.observe(w)
      return () => parent.unobserve(w)
    }
  }
  export function mutator<T>(parent: Y.Map<any>, key: string): Mutator<T> {
    return (value: T) => parent.set(key, value)
  }
}
