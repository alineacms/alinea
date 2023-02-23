import {Lazy} from './util/Lazy'

export type Hint =
  | Hint.String
  | Hint.Number
  | Hint.Boolean
  | Hint.Array
  | Hint.Literal
  | Hint.Definition
  | Hint.Object
  | Hint.Union
  | Hint.Intersection
  | Hint.Extern

const {entries, keys, values} = Object

export namespace Hint {
  export interface String {
    type: 'string'
  }
  export interface Number {
    type: 'number'
  }
  export interface Boolean {
    type: 'boolean'
  }
  export interface Array {
    type: 'array'
    inner: Hint
  }
  export interface Literal {
    type: 'literal'
    value: string
  }
  export interface Definition {
    type: 'definition'
    name: string
    fields: Lazy<Record<string, Hint>>
    extend: Hint[]
  }
  export interface Object {
    type: 'object'
    fields: Record<string, Hint>
  }
  export interface Union {
    type: 'union'
    options: Hint[]
  }
  export interface Intersection {
    type: 'intersection'
    options: Hint[]
  }
  export interface ExternLocation {
    name: string
    package: string
  }
  export interface Extern {
    type: 'extern'
    from: ExternLocation
    typeParams: Hint[]
  }
  export interface TypeDefinition extends Definition {
    parents: string[]
  }

  export function String(): Hint {
    return {type: 'string'}
  }
  export function Number(): Hint {
    return {type: 'number'}
  }
  export function Boolean(): Hint {
    return {type: 'boolean'}
  }
  export function Literal(value: string): Hint {
    return {type: 'literal', value}
  }
  export function Array(inner: Hint): Hint {
    return {type: 'array', inner}
  }
  export function Definition(
    name: string,
    fields: Lazy<Record<string, Hint>>,
    ...extend: Hint[]
  ): Hint {
    return {type: 'definition', name, fields, extend}
  }
  export function Object(fields: Record<string, Hint>): Hint {
    return {type: 'object', fields}
  }
  export function Union(options: Hint[]): Hint {
    return {type: 'union', options}
  }
  export function Intersection(...options: Hint[]): Hint {
    return {type: 'intersection', options}
  }
  export function Extern(from: ExternLocation, ...typeParams: Hint[]): Hint {
    return {type: 'extern', from, typeParams}
  }

  // Let's follow GraphQL rules for now
  // It would be nice to be less restrictive in the future
  const validIdentifier = /^[_A-Za-z][_0-9A-Za-z]*$/
  export function isValidIdentifier(identifier: string) {
    return validIdentifier.test(identifier)
  }

  export function isDefinitionName(identifier: string) {
    return identifier.charAt(0).toUpperCase() === identifier[0]
  }

  export function externs(
    hints: Hint[],
    map = new Map<string, Set<string>>()
  ): Map<string, Set<string>> {
    for (const hint of hints)
      switch (hint.type) {
        case 'array':
          externs([hint.inner], map)
          continue
        case 'definition':
          const fields = Lazy.get(hint.fields)
          externs(values(fields).concat(hint.extend), map)
          continue
        case 'object':
          externs(values(hint.fields), map)
          continue
        case 'intersection':
        case 'union':
          externs(hint.options, map)
          continue
        case 'extern':
          if (map.has(hint.from.package)) {
            map.get(hint.from.package)!.add(hint.from.name)
          } else {
            map.set(hint.from.package, new Set([hint.from.name]))
          }
          externs(hint.typeParams, map)
          continue
      }
    return map
  }

  export function* definitions(
    hints: Hint[],
    parents: string[] = []
  ): Generator<TypeDefinition> {
    for (const hint of hints)
      switch (hint.type) {
        case 'array':
          yield* definitions([hint.inner], parents)
          break
        case 'definition':
          const fields = Lazy.get(hint.fields)
          for (const [name, inner] of entries(fields))
            yield* definitions([inner], parents.concat(hint.name, name))
          yield* definitions(hint.extend, parents.concat(hint.name))
          yield {...hint, parents}
          continue
        case 'object':
          for (const [name, inner] of entries(hint.fields))
            yield* definitions([inner], parents.concat(name))
          continue
        case 'intersection':
        case 'union':
          yield* definitions(hint.options, parents)
          continue
        case 'extern':
          yield* definitions(hint.typeParams, parents)
          continue
      }
  }

  export function equals(a: Hint, b: Hint): boolean {
    if (a.type !== b.type) return false
    switch (a.type) {
      case 'string':
      case 'number':
      case 'boolean':
        return true
      case 'array':
        const bArray = b as Hint.Array
        return equals(a.inner, bArray.inner)
      case 'literal':
        const bLiteral = b as Hint.Literal
        return a.value === bLiteral.value
      case 'definition':
        const bDefinition = b as Hint.Definition
        const aFields = Lazy.get(a.fields),
          bFields = Lazy.get(bDefinition.fields)
        return (
          a.name === bDefinition.name &&
          keys(aFields).length === keys(bFields).length &&
          keys(aFields).every(key => {
            return equals(aFields[key], bFields[key])
          })
        )
      case 'object':
        const bRecord = b as Hint.Object
        return (
          keys(a.fields).length === keys(bRecord.fields).length &&
          keys(a.fields).every(key => {
            return equals(a.fields[key], bRecord.fields[key])
          })
        )
      case 'intersection':
      case 'union':
        const bUnion = b as Hint.Union
        return a.options.every((option, i) => {
          return equals(option, bUnion.options[i])
        })
      case 'extern':
        const bExtern = b as Hint.Extern
        return (
          a.from.name === bExtern.from.name &&
          a.from.package === bExtern.from.package &&
          a.typeParams.every((param, i) => equals(param, bExtern.typeParams[i]))
        )
    }
  }
}
