import {ComponentType} from 'react'
import {Field} from './Field.js'
import {assign, create, defineProperty, entries} from './util/Objects.js'
import {rowId} from './util/RowId.js'

export interface SectionDefinition {
  [key: string]: Field<any, any> | Section
}

export interface SectionData {
  definition: SectionDefinition
  fields: Record<string, Field>
  view: string
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

  // export function provideView<
  //   Fields,
  //   Factory extends (...args: Array<any>) => Section<Fields>
  // >(view: SectionView<Fields>, factory: Factory): Factory {
  //   return ((...args: Array<any>) => {
  //     const section = factory(...args)
  //     section[Section.Data].view = view as SectionView<object>
  //     return section
  //   }) as Factory
  // }

  export function view(section: Section) {
    return section[Section.Data].view
  }

  export function definition(section: Section) {
    return section[Section.Data].definition
  }

  export function fields(section: Section) {
    return section[Section.Data].fields
  }

  export function isSection(value: any): value is Section {
    return Boolean(value && value[Section.Data])
  }
}

interface SectionOptions extends Omit<SectionData, 'fields'> {
  fields?: Record<string, Field>
}

export function section<Fields>(data: SectionOptions): Section<Fields> {
  const section = create(null)
  const fields: Record<string, Field> = create(null)
  for (const [key, value] of entries(data.definition)) {
    if (Field.isField(value)) {
      defineProperty(section, key, {value, enumerable: false})
      fields[key] = value
    } else if (Section.isSection(value)) {
      assign(fields, Section.fields(value))
    }
  }
  // This magic property is the only enumerable property on the section
  // Any tools that use a section will have to retrieve the fields from
  // the section data
  const id = rowId()
  section[id] = section
  if (!data.fields) assign(data, {fields})
  defineProperty(section, Section.Data, {
    value: data,
    enumerable: false
  })
  return section as Section<Fields>
}
