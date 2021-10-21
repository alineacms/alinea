import {Lazy} from './Lazy'

export type LazyRecord<V> = Lazy<{[key: string]: Lazy<V>}>

export namespace LazyRecord {
  export function iterate<V>(collection: LazyRecord<V>): Array<[string, V]> {
    return Object.entries(Lazy.get(collection)).map(([key, value]) => [
      key,
      get(collection, key)
    ])
  }

  export function keys<V>(collection: LazyRecord<V>): Array<string> {
    return Object.keys(Lazy.get(collection))
  }

  export function get<V>(collection: LazyRecord<V>, key: string): V {
    return Lazy.get(Lazy.get(collection)[key])
  }
}
