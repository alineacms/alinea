import {Hint} from './Hint.js'
import {Type, TypeTarget} from './Type.js'
import {MediaFile, MediaLibrary} from './media/MediaTypes.js'
import {RecordShape} from './shape/RecordShape.js'
import {isValidIdentifier} from './util/Identifiers.js'
import {entries, fromEntries, keys} from './util/Objects.js'

const shapesCache = new WeakMap<Schema, Record<string, RecordShape>>()
const hintCache = new WeakMap<Schema, Hint.Union>()

export interface Schema<Definitions = {}> extends Record<string, Type> {}

export namespace Schema {
  export type Targets = Map<TypeTarget, string>

  export function validate(schema: Schema) {
    for (const key of keys(schema)) {
      switch (key) {
        case 'Entry':
          throw new Error(`Entry is a reserved Type name`)
        case 'MediaFile':
          if (schema[key] !== MediaFile)
            throw new Error(`MediaFile is a reserved Type name`)
          break
        case 'MediaLibrary':
          if (schema[key] !== MediaLibrary)
            throw new Error(`MediaLibrary is a reserved Type name`)
          break
        default:
          if (!isValidIdentifier(key))
            throw new Error(
              `Invalid Type name "${key}", use only a-z, A-Z, 0-9, and _`
            )
          const type = schema[key]
          const {contains} = Type.meta(type)
          if (contains) {
            for (const name of contains) {
              if (!schema[name])
                throw new Error(
                  `Type "${key}" contains "${name}", but that Type does not exist`
                )
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
