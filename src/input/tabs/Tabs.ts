import {
  Expand,
  Field,
  Section,
  SectionData,
  SectionDefinition,
  Type,
  section,
  type
} from 'alinea/core'
import {entries, fromEntries} from 'alinea/core/util/Objects'

export class TabsSection implements SectionData {
  definition: SectionDefinition
  fields: Record<string, Field>
  constructor(public types: Array<Type>) {
    this.definition = fromEntries(types.flatMap(entries))
    this.fields = fromEntries(
      types.flatMap(entries).filter(([key, field]) => Field.isField(field))
    )
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
export function tabs<Types extends Array<Type>>(
  ...types: Types
): Section<ArrayIntersection<Types>> {
  return section(new TabsSection(types))
}

/** Create a tab */
export const tab = type
