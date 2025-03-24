import type {ComponentType} from 'react'
import {Field} from './Field.js'
import {assign, create, defineProperty, entries} from './util/Objects.js'
import {rowId} from './util/RowId.js'
import type {View} from './View.js'

export interface SectionDefinition {
  [key: string]: Field<any, any> | Section
}

export interface SectionData {
  definition: SectionDefinition
  fields: Record<string, Field>
  sections: Array<Section>
  view?: View<{section: Section}>
}

export interface SectionI extends Record<string, Field> {}

export declare class SectionI {
  get [Section.Data](): SectionData
}

export type Section<Fields = object> = Fields & SectionI

export type SectionView<Fields> = ComponentType<{
  section: Section<Fields>
}>

export namespace Section {
  export const Data = Symbol.for('@alinea/Section.Data')

  export function view(section: Section): View<{section: Section}> | undefined {
    return section[Section.Data].view
  }

  export function referencedViews(section: Section): Array<string> {
    const {view, sections} = section[Section.Data]
    return [view, ...sections.flatMap(referencedViews)].filter(
      v => typeof v === 'string'
    )
  }

  export function definition(section: Section) {
    return section[Section.Data].definition
  }

  export function fields(section: Section) {
    return section[Section.Data].fields
  }

  export function isSection(value: any): value is Section {
    return Boolean(value?.[Section.Data])
  }
}

interface SectionOptions extends Omit<SectionData, 'fields' | 'sections'> {
  fields?: Record<string, Field>
  sections?: Array<Section>
}

export function section<Fields>(data: SectionOptions): Section<Fields> {
  const section = create(null)
  const sections = [] as Array<Section>
  const fields: Record<string, Field> = create(null)
  for (const [key, value] of entries(data.definition)) {
    if (Field.isField(value)) {
      defineProperty(section, key, {value, enumerable: false})
      fields[key] = value
    } else if (Section.isSection(value)) {
      sections.push(value)
      assign(fields, Section.fields(value))
    }
  }
  // This magic property is the only enumerable property on the section
  // Any tools that use a section will have to retrieve the fields from
  // the section data
  const id = rowId()
  section[id] = section
  if (!data.fields) assign(data, {fields})
  if (!data.sections) assign(data, {sections})
  defineProperty(section, Section.Data, {
    value: data,
    enumerable: false
  })
  return section as Section<Fields>
}
