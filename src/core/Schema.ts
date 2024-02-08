import {Hint} from './Hint.js'
import {Type, TypeTarget} from './Type.js'
import {RecordShape} from './shape/RecordShape.js'
import {entries, fromEntries} from './util/Objects.js'

const shapesCache = new WeakMap<Schema, Record<string, RecordShape>>()
const hintCache = new WeakMap<Schema, Hint.Union>()

export interface Schema<Definitions = {}> extends Record<string, Type> {}

export namespace Schema {
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

  export function typeNames(schema: Schema): Map<Type, string> {
    return new Map(entries(schema).map(([key, type]) => [type, key]))
  }
}

export interface SchemaTypes {
  [key: string]: Type
}

export interface SchemaOptions<Definition> {
  types: Definition
}

export function schema<Definition extends SchemaTypes>(
  options: SchemaOptions<Definition>
): Definition
/** @deprecated See https://github.com/alineacms/alinea/issues/373 */
export function schema<Definition extends SchemaTypes>(
  options: Definition
): Definition
export function schema<Definition>(
  options: SchemaOptions<Definition>
): Definition {
  return (options.types ?? options) as any
}
