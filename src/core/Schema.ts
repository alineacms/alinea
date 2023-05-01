import {Cursor} from 'alinea/backend2/pages/Cursor'
import {Field} from './Field.js'
import {Type} from './Type.js'

export type Schema = Record<string, Type>

export namespace Schema {
  export type Infer<T> = T extends Type<infer Fields>
    ? Fields
    : T extends Field<infer Value, any>
    ? Value
    : T extends Cursor<infer Row>
    ? Row
    : never
}

export function schema<T extends Schema>(types: T): T {
  return types
}

/*
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
  export type TypeOf<T> = T extends Schema<infer U>
    ? U
    : T extends Type<infer U>
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

  constructor(public types: LazyRecord<Type<any>>) {
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

  get keys() {
    return Array.from(this.typeMap.keys())
  }
}

export function schema<Types extends LazyRecord<any>>(
  types: Types
): Schema<TypeToEntry<TypeToRows<Types>>> {
  return new Schema(types)
}
*/
