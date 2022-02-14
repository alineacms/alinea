import {Section, Type} from '@alinea/core'
import {Lazy} from '@alinea/core/util/Lazy'
import type {UnionToIntersection} from '@alinea/core/util/Types'

export class TabsSection<T = any> extends Section<T> {
  constructor(public types: Array<Type>) {
    super(
      Object.fromEntries(
        types
          .map(type => Lazy.get(type.fields))
          .flatMap(fields => Object.entries(fields))
      )
    )
  }
}

export function createTabs<T extends Array<Type>>(...types: T) {
  return new TabsSection<UnionToIntersection<Type.Of<T[number]>>>(types)
}
