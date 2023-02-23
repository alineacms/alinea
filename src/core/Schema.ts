import {Collection, Cursor, Selection} from 'alinea/store'
import {Entry} from './Entry'
import {createError} from './ErrorWithCode'
import {Field} from './Field'
import {Hint} from './Hint'
import {RecordShape} from './shape/RecordShape'
import type {TypeConfig} from './Type'
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
export type TypesOf<T> = T extends HasType ? T['type'] : string
export type ExtractType<T, K extends string> = T extends {type: K}
  ? Extract<T, {type: K}>
  : any

export namespace Schema {
  /** Utility to infer the type of a Schema, Type, Field or any Store type */
  export type TypeOf<T> = T extends Schema<infer U>
    ? U
    : T extends TypeConfig<any, infer U>
    ? U
    : T extends Type<any, infer U>
    ? U
    : T extends Field<any, any, infer Q>
    ? Q
    : T extends Selection<infer U>
    ? U
    : T extends Cursor<infer U>
    ? U
    : never
}

export class Schema<T = any> {
  shape: Record<string, RecordShape<any>>
  hint: Hint
  typeMap = new Map<string, Type<any>>()

  constructor(public types: LazyRecord<TypeConfig<any>>) {
    this.shape = Object.fromEntries(
      LazyRecord.iterate(types).map(([key, type]) => {
        return [key, type.shape]
      })
    )
    for (const [name, type] of LazyRecord.iterate(types))
      this.typeMap.set(name, type.toType(name))
    this.hint = Hint.Union(
      Array.from(this.typeMap.values()).map(type => {
        return type.hint
      })
    )
  }

  validate() {
    for (const type of this.allTypes)
      if (!type.hasField('title') || !type.hasField('path'))
        throw createError(
          `Missing title or path field in type ${type.name}, see https://alinea.sh/docs/reference/titles`
        )
  }

  configEntries() {
    return LazyRecord.iterate(this.types)
  }

  concat<X>(that: Schema<X>): Schema<T | X> {
    return schema(LazyRecord.concat(this.types, that.types)) as any
  }

  get allTypes() {
    return Array.from(this.typeMap.values())
  }

  definitions() {
    return Hint.definitions(this.allTypes.map(type => type.hint))
  }

  entries() {
    return this.typeMap.entries()
  }

  [Symbol.iterator]() {
    return this.typeMap.entries()[Symbol.iterator]()
  }

  type(name: string): Type<any> | undefined {
    return this.typeMap.get(name)
  }

  /** Keys of every type */
  get keys() {
    return Array.from(this.typeMap.keys())
  }
}

/** Create a schema, expects a string record of Type instances */
export function schema<Types extends LazyRecord<any /* TypeConfig */>>(
  types: Types
): Schema<TypeToEntry<TypeToRows<Types>>> {
  return new Schema(types)
}
