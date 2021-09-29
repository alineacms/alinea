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
  export function mutator<T>(parent: Y.Map<any>, key: string): Mutator<T> {
    return (value: T) => parent.set(key, value)
  }
}
