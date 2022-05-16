import {Collection, Cursor, Selection} from '@alinea/store'
import {Entry} from './Entry'
import {Field} from './Field'
import type {TypeConfig} from './Type'
import {Type} from './Type'
import {LazyRecord} from './util/LazyRecord'
import type {Workspace} from './Workspace'

export type HasType = {type: string}

type UnionOfValues<T> = T[keyof T]
type TypeToRows<T> = {[K in keyof T]: Type.Of<T[K]> & Entry}
type TypeToEntry<T> = T extends {[key: string]: any}
  ? UnionOfValues<{[K in keyof T]: T[K] & {type: K}}>
  : never

export type DataOf<T> = T extends Collection<infer U> ? U : never
export type EntryOf<T> = T extends Schema<infer U> ? U : never
export type TypesOf<T> = T extends HasType ? T['type'] : string

export namespace Schema {
  /** Utility to infer the type of a Schema, Type, Feld or any Store type */
  export type TypeOf<T> = T extends Schema<infer U>
    ? U
    : T extends Type<infer U>
    ? U
    : T extends Field<infer U, infer M, infer Q>
    ? Q
    : T extends Selection<infer U>
    ? U
    : T extends Cursor<infer U>
    ? U
    : never
}

/** Describes the different types of entries */
export class Schema<T = any> {
  typeMap = new Map<string, Type>()

  constructor(public workspace: Workspace<T>, public config: SchemaConfig<T>) {
    for (const [name, type] of LazyRecord.iterate(config.types)) {
      this.typeMap.set(name, new Type(this, name, type))
    }
  }

  get types() {
    return Object.fromEntries(this.typeMap.entries())
  }

  entries() {
    return this.typeMap.entries()
  }

  static shape<T>(config: SchemaConfig<T>) {
    return Object.fromEntries(
      LazyRecord.iterate(config.types).map(([key, type]) => {
        return [key, Type.shape(type)]
      })
    )
  }

  [Symbol.iterator]() {
    return this.typeMap.entries()[Symbol.iterator]()
  }

  /** Get a type by name */
  type<K extends TypesOf<T>>(name: K): Type<Extract<T, {type: K}>> | undefined
  type(name: string): Type | undefined
  type(name: any): any {
    return this.typeMap.get(name)
  }

  /** Keys of every type */
  get keys() {
    return Array.from(this.typeMap.keys())
  }

  /** A generic collection used to query any type in this schema */
  collection(): Collection<T> {
    return new Collection('Entry')
  }
}

export type SchemaConfig<T = any> = {
  types: LazyRecord<TypeConfig>
  concat<X>(that: SchemaConfig<X>): SchemaConfig<T | X>
}

/** Create a schema, expects a string record of Type instances */
export function schema<Types extends LazyRecord<TypeConfig>>(
  types: Types
): SchemaConfig<TypeToEntry<TypeToRows<Types>>> {
  return {
    types,
    concat(that) {
      return schema(LazyRecord.concat(types, that.types))
    }
  }
}
