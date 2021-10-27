import * as Y from 'yjs'
import {Value} from '../Value'

export class ScalarValue<T> implements Value<T> {
  static inst = new ScalarValue()
  constructor() {}
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
    return (value: T) => parent.set(key, value)
  }
}
