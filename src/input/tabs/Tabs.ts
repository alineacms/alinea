import {Section, Type, type, TypeConfig, UnionToIntersection} from 'alinea/core'
import {Lazy} from 'alinea/core/util/Lazy'

/** Internal representation of tabs */
export class TabsSection<T> extends Section<T> {
  constructor(public types: Array<TypeConfig<any, any>>) {
    super(
      Object.fromEntries(
        types
          .flatMap(type => type.sections)
          .flatMap(section => Object.entries(Lazy.get(section.fields) || {}))
      )
    )
  }
}

/** Create tabs configuration */
export function tabs<T extends Array<TypeConfig<any, any>>>(
  ...types: T
): Section<
  UnionToIntersection<Type.Raw<T[number]>>,
  UnionToIntersection<Type.Of<T[number]>>
> {
  return new TabsSection(types)
}

/** Create a tab configuration */
export const tab = type
