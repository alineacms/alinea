import {Collection} from 'helder.store'
import {Entry} from './Entry'
import {Type} from './Type'
import {RecordValue} from './type/RecordValue'
import {LazyRecord} from './util/LazyRecord'

export type HasType = {type: string}

type UnionOfValues<T> = T[keyof T]
type TypeToRows<T> = {[K in keyof T]: Type.Of<T[K]> & Entry}
type TypeToEntry<T> = T extends {[key: string]: any}
  ? UnionOfValues<{[K in keyof T]: T[K] & {type: K}}>
  : never

export type DataOf<T> = T extends Collection<infer U> ? U : never
export type EntryOf<T> = T extends Schema<infer U> ? U : never

export function createSchema<Types extends LazyRecord<Type>>(
  types: Types
): Schema<TypeToEntry<TypeToRows<Types>>> {
  return new Schema(types) as any
}

export type TypesOf<T> = T extends HasType ? T['type'] : string

export class Schema<T = any> {
  #types: LazyRecord<Type<T>>

  constructor(types: LazyRecord<Type<T>>) {
    this.#types = types
  }

  get types() {
    return LazyRecord.resolve(this.#types)
  }

  get valueTypes(): Record<string, RecordValue> {
    return Object.fromEntries(
      Array.from(this).map(([key, channel]) => {
        return [key, channel.valueType]
      })
    )
  }

  [Symbol.iterator]() {
    return LazyRecord.iterate(this.#types)[Symbol.iterator]()
  }

  type<K extends TypesOf<T>>(name: K): Type<Extract<T, {type: K}>> | undefined {
    return LazyRecord.get(this.#types, name)
  }

  get keys() {
    return LazyRecord.keys(this.#types)
  }

  get collections(): {
    [K in TypesOf<T>]: Collection<Extract<T, {type: K}>>
  } {
    return Object.fromEntries(
      Object.keys(this.#types).map(name => {
        return [name, this.collection(name)]
      })
    ) as any
  }

  collection<K extends TypesOf<T>>(type: K): Collection<Extract<T, {type: K}>> {
    const alias = type as string
    return new Collection('Entry', {
      where: Entry.as(alias).type.is(alias),
      alias
    })
  }

  entry: Collection<T> = new Collection('Entry')
}
