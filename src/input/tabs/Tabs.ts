import {Field, ObjectUnion, SectionData, Type, section, type} from 'alinea/core'
import {entries, fromEntries} from 'alinea/core/util/Objects'

export class TabsSection implements SectionData {
  fields: Record<string, Field>
  constructor(public types: Array<Type>) {
    this.fields = fromEntries(types.flatMap(entries))
  }
}

/** Create tabs */
export function tabs<Types extends Array<Type>>(...types: Types) {
  return section<
    ObjectUnion<Types[number] extends Type<infer Inner> ? Inner : never>
  >(new TabsSection(types))
}

/** Create a tab */
export const tab = type
