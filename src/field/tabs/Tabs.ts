import {Field} from 'alinea/core/Field'
import {
  Section,
  section,
  SectionData,
  SectionDefinition
} from 'alinea/core/Section'
import {Type, type} from 'alinea/core/Type'
import {entries, fromEntries} from 'alinea/core/util/Objects'

export class TabsSection implements SectionData {
  view = 'alinea/field/tabs/Tabs.view#TabsView'
  definition: SectionDefinition
  fields: Record<string, Field>
  sections: Array<Section>
  constructor(public types: Array<Type>) {
    this.definition = fromEntries(types.flatMap(entries))
    this.fields = fromEntries(
      types.flatMap(entries).filter(([key, field]) => Field.isField(field))
    )
    this.sections = types.flatMap(Type.sections)
  }
}

// Source: https://stackoverflow.com/a/77965444
type Cast<From, To> = From extends To ? From : never
type FoldIntoIntersection<
  T extends readonly {}[],
  Acc extends {} = {}
> = T extends readonly [infer H, ...infer HS]
  ? FoldIntoIntersection<Cast<HS, readonly {}[]>, Acc & H>
  : Acc

/** Create tabs */
export function tabs<const Types extends Array<Type>>(
  ...types: Types
): FoldIntoIntersection<Types> {
  return section(new TabsSection(types))
}

/** Create a tab */
export const tab = type
