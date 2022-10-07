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
  }
  export interface Object {
    type: 'object'
    fields: Record<string, Hint>
  }
  export interface Union {
    type: 'union'
    options: Hint[]
  }
  export interface Extern {
    type: 'extern'
    name: string
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
    fields: Lazy<Record<string, Hint>>
  ): Hint {
    return {type: 'definition', name, fields}
  }
  export function Object(fields: Record<string, Hint>): Hint {
    return {type: 'object', fields}
  }
  export function Union(options: Hint[]): Hint {
    return {type: 'union', options}
  }
  export function Extern(name: string, ...typeParams: Hint[]): Hint {
    return {type: 'extern', name, typeParams}
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
          yield {...hint, parents}
          continue
        case 'object':
          for (const [name, inner] of entries(hint.fields))
            yield* definitions([inner], parents.concat(name))
          continue
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
      case 'union':
        const bUnion = b as Hint.Union
        return a.options.every((option, i) => {
          return equals(option, bUnion.options[i])
        })
      case 'extern':
        const bExtern = b as Hint.Extern
        return (
          a.name === bExtern.name &&
          a.typeParams.every((param, i) => equals(param, bExtern.typeParams[i]))
        )
    }
  }
}
