import {Collection} from 'helder.store'
import {Entry} from './Entry'
import {Type} from './Type'
import {LazyRecord} from './util/LazyRecord'
import {RecordValue} from './value/RecordValue'

export type HasType = {type: string}

type UnionOfValues<T> = T[keyof T]
type TypeToRows<T> = {[K in keyof T]: Type.Of<T[K]> & Entry}
type TypeToEntry<T> = T extends {[key: string]: any}
  ? UnionOfValues<{[K in keyof T]: T[K] & {type: K}}>
  : never

export type DataOf<T> = T extends Collection<infer U> ? U : never
export type EntryOf<T> = T extends Schema<infer U> ? U : never

export function schema<Types extends LazyRecord<Type>>(
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
    return LazyRecord.get(this.#types, name) as Type<Extract<T, {type: K}>>
  }

  get keys() {
    return LazyRecord.keys(this.#types)
  }

  collections(workspace: string): {
    [K in TypesOf<T>]: Collection<Extract<T, {type: K}>>
  } {
    return Object.fromEntries(
      Object.keys(this.#types).map(name => {
        return [name, this.collection(workspace, name as any)]
      })
    ) as any
  }

  collection<K extends TypesOf<T>>(
    workspace: string,
    type: K
  ): Collection<Extract<T, {type: K}>> {
    const alias = type as string
    const fields = Entry.as(alias)
    return new Collection('Entry', {
      where: fields.type.is(alias).and(fields.workspace.is(workspace)),
      alias
    })
  }

  entry: Collection<T> = new Collection('Entry')
}
