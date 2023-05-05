import {Cursor} from 'alinea/core/pages/Cursor'
import {Field} from './Field.js'
import {Hint} from './Hint.js'
import {Type, TypeTarget} from './Type.js'
import {RecordShape} from './shape/RecordShape.js'
import {entries, fromEntries} from './util/Objects.js'

const shapesCache = new WeakMap<Schema, Record<string, RecordShape>>()
const hintCache = new WeakMap<Schema, Hint.Union>()

export interface Schema<Definitions = object> extends Record<string, Type> {}

export namespace Schema {
  export type Infer<T> = T extends Type<infer Fields>
    ? Fields
    : T extends Field<infer Value, any>
    ? Value
    : T extends Cursor<infer Row>
    ? Row
    : never

  export type Targets = Map<TypeTarget, string>

  export function shapes(schema: Schema): Record<string, RecordShape> {
    if (!shapesCache.has(schema))
      shapesCache.set(
        schema,
        fromEntries(
          entries(schema).map(([key, type]) => {
            return [key, Type.shape(type!)]
          })
        )
      )
    return shapesCache.get(schema)!
  }

  export function hint(schema: Schema): Hint.Union {
    if (!hintCache.has(schema)) {
      hintCache.set(
        schema,
        Hint.Union(
          entries(schema).map(([key, type]) => {
            return Type.hint(type!)
          })
        )
      )
    }
    return hintCache.get(schema)!
  }

  export function targets(schema: Schema): Targets {
    return new Map(
      entries(schema).map(([key, type]) => {
        return [Type.target(type), key]
      })
    )
  }
}

export function schema<T extends Schema>(types: T): T {
  return types
}
