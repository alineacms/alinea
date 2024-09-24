import {Hint} from './Hint.js'
import {Type, TypeTarget} from './Type.js'
import {RecordShape} from './shape/RecordShape.js'
import {isValidIdentifier} from './util/Identifiers.js'
import {entries, fromEntries, values} from './util/Objects.js'

const shapesCache = new WeakMap<Schema, Record<string, RecordShape>>()
const hintCache = new WeakMap<Schema, Hint.Union>()

export interface Schema<Definitions = {}> extends Record<string, Type> {}

export namespace Schema {
  export type Targets = Map<TypeTarget, string>

  export function views(schema: Schema) {
    return new Set(values(schema).flatMap(Type.views))
  }

  export function validate(schema: Schema) {
    const keyOfType = typeNames(schema)
    for (const [key, type] of entries(schema)) {
      switch (key) {
        case 'Entry':
          throw new Error(`${key} is a reserved Type name`)
        default:
          if (!isValidIdentifier(key))
            throw new Error(
              `Invalid Type name "${key}", use only a-z, A-Z, 0-9, and _`
            )
          const {contains} = Type.meta(type)
          if (contains) {
            for (const inner of contains) {
              if (typeof inner === 'string') {
                if (!schema[inner])
                  throw new Error(
                    `Type "${key}" contains "${inner}", but that Type does not exist`
                  )
              } else {
                const hasType = keyOfType.has(inner)
                if (!hasType)
                  throw new Error(
                    `Type "${key}" contains "${Type.label(
                      inner
                    )}", but that Type does not exist`
                  )
              }
            }
          }
      }
    }
  }

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

  export function contained(
    schema: Schema,
    contains: Array<string | Type>
  ): Array<string> {
    // Todo: cache this
    const keyOfType = typeNames(schema)
    return contains.map(inner => {
      if (typeof inner === 'string') return inner
      // This is validated
      return keyOfType.get(inner)!
    })
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
