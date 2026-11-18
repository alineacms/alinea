import {type RecordShape, type UnionShape, shape as s} from '@alinea/graft'
import {EntryRecord} from './EntryRecord.js'
import {getReplaced, getType} from './Internal.js'
import {Type} from './Type.js'
import {isValidIdentifier} from './util/Identifiers.js'
import {lazyRecord} from './util/LazyRecord.js'
import {entries, fromEntries, keys, values} from './util/Objects.js'

export interface Schema<Definitions = {}> extends Record<string, Type> {}

const entryShapes = new WeakMap<Schema, UnionShape>()

/** Keys of an entry file around its fields, see `parseRecord` */
const header = [
  EntryRecord.id,
  EntryRecord.type,
  EntryRecord.index,
  EntryRecord.root,
  EntryRecord.seeded,
  '_i18nId'
]

export namespace Schema {
  /** The shapes of the types of a schema by name, see `Type.shape` */
  export function shapes(schema: Schema): Record<string, RecordShape> {
    return lazyRecord(
      () => keys(schema),
      key => Type.shape(schema[key])
    )
  }

  /** How entry files of a schema merge: by their type, then per field */
  export function shape(schema: Schema): UnionShape {
    const known = entryShapes.get(schema)
    if (known) return known
    const atomic = s.atomic()
    const types = lazyRecord(
      () => keys(schema),
      key => {
        const type = Type.shape(schema[key])
        return s.record(
          {...fromEntries(header.map(name => [name, atomic])), ...type.fields},
          {renamed: type.renamed}
        )
      }
    )
    const result = s.union(EntryRecord.type, types)
    entryShapes.set(schema, result)
    return result
  }

  export function referencedViews(schema: Schema): Array<string> {
    return values(schema).flatMap(type => Type.referencedViews(type))
  }

  export function validate(schema: Schema) {
    const keyOfType = typeNames(schema)
    for (const [key, type] of entries(schema)) {
      switch (key) {
        case 'Entry':
          throw new Error(`${key} is a reserved Type name`)
        default: {
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
  }

  export function typeNames(schema: Schema): Map<Type, string> {
    const names = new Map(entries(schema).map(([key, type]) => [type, key]))
    // A built-in type is known by the name of the type standing in for it
    for (const [key, type] of entries(schema)) {
      const replaced = getReplaced(type) as Type | undefined
      if (replaced && !names.has(replaced)) names.set(replaced, key)
    }
    return names
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
