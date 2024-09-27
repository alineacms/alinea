import {Field} from 'alinea/core/Field'
import {
  Section,
  section,
  SectionData,
  SectionDefinition
} from 'alinea/core/Section'
import {Type, type} from 'alinea/core/Type'
import {entries, fromEntries} from 'alinea/core/util/Objects'
import type {UnionToIntersection} from 'alinea/core/util/Types'

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

type ArrayIntersection<T> = Type<
  UnionToIntersection<T extends Array<Type<infer V>> ? V : never>
>

/** Create tabs */
export function tabs<Types extends Array<Type>>(
  ...types: Types
): ArrayIntersection<Types> {
  return section(new TabsSection(types))
}

/** Create a tab */
export const tab = type
