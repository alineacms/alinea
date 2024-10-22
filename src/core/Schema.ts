import {getType} from './Internal.js'
import {Type} from './Type.js'
import {RecordShape} from './shape/RecordShape.js'
import {isValidIdentifier} from './util/Identifiers.js'
import {entries, fromEntries, values} from './util/Objects.js'

const shapesCache = new WeakMap<Schema, Record<string, RecordShape>>()

export interface Schema<Definitions = {}> extends Record<string, Type> {}

export namespace Schema {
  export function referencedViews(schema: Schema): Array<string> {
    return values(schema).flatMap(type => Type.referencedViews(type))
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
          const {contains} = getType(type)
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
): Definition {
  return (options.types ?? options) as any
}
