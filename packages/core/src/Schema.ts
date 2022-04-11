import {Collection, Cursor, Selection} from '@alinea/store'
import {Entry} from './Entry'
import {Field} from './Field'
import {Type} from './Type'
import {LazyRecord} from './util/LazyRecord'

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

export namespace Schema {
  // Generic utility to get the type of a schema, type or field or any Store type
  export type TypeOf<T> = T extends Schema<infer U>
    ? U
    : T extends Type<infer U>
    ? U
    : T extends Field<infer U, infer M>
    ? U
    : T extends Selection<infer U>
    ? U
    : T extends Cursor<infer U>
    ? U
    : never
}

export class Schema<T = any> {
  private __types: LazyRecord<Type<T>>

  constructor(types: LazyRecord<Type<T>>) {
    this.__types = types
  }

  get types() {
    return LazyRecord.resolve(this.__types)
  }

  get valueTypes() {
    return Object.fromEntries(
      Array.from(this).map(([key, channel]) => {
        return [key, channel.valueType]
      })
    )
  }

  [Symbol.iterator]() {
    return LazyRecord.iterate(this.__types)[Symbol.iterator]()
  }

  type<K extends TypesOf<T>>(name: K): Type<Extract<T, {type: K}>> | undefined {
    return LazyRecord.get(this.__types, name) as unknown as Type<
      Extract<T, {type: K}>
    >
  }

  get keys() {
    return LazyRecord.keys(this.__types)
  }

  collections(workspace: string): {
    [K in TypesOf<T>]: Collection<Extract<T, {type: K}>>
  } {
    return Object.fromEntries(
      Object.keys(this.__types).map(name => {
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
