import {
  Expand,
  SectionData,
  SectionDefinition,
  Type,
  section,
  type
} from 'alinea/core'
import {entries, fromEntries} from 'alinea/core/util/Objects'

export class TabsSection implements SectionData {
  definition: SectionDefinition
  constructor(public types: Array<Type>) {
    this.definition = fromEntries(types.flatMap(entries))
  }
}

type ArrayIntersection<T> = Expand<
  T extends [...infer Rest, infer Tail]
    ? Tail extends Type<infer D>
      ? Omit<ArrayIntersection<Rest>, keyof D> & D
      : ArrayIntersection<Rest>
    : unknown
>

/** Create tabs */
export function tabs<Types extends Array<Type>>(...types: Types) {
  return section<ArrayIntersection<Types>>(new TabsSection(types))
}

/** Create a tab */
export const tab = type
