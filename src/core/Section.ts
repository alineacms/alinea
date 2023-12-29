import {ComponentType} from 'react'
import {Field} from './Field.js'
import {createId} from './Id.js'
import {assign, create, defineProperty, entries} from './util/Objects.js'

export interface SectionDefinition {
  [key: string]: Field<any, any> | Section
}

export interface SectionData {
  definition: SectionDefinition
  fields: Record<string, Field>
  view?: ComponentType<{
    section: Section
  }>
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
  export const PREFIX = '@@@'

  export function provideView<
    Fields,
    Factory extends (...args: Array<any>) => Section<Fields>
  >(view: SectionView<Fields>, factory: Factory): Factory {
    return ((...args: Array<any>) => {
      const section = factory(...args)
      section[Section.Data].view = view as SectionView<object>
      return section
    }) as Factory
  }

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
  section[`${Section.PREFIX}${createId()}`] = section
  if (!data.fields) assign(data, {fields})
  defineProperty(section, Section.Data, {
    value: data,
    enumerable: false
  })
  return section as Section<Fields>
}

// A section holds fields and optionally a view to render them
/*export class Section<Fields extends FieldRecord = FieldRecord> {
  constructor(
    fields: Fields,
    view?: ComponentType<{state: InputState}>
  ) {
    for (const [key, value] of entries(fields))
      this[key] = value
    this[`@@@${createId()}`] = this
  }
  [key: string]: Field | Section
}

export namespace Section {
  type Presentational = ReactElement

  export type Fields = Lazy<
    {
      // This used to be Lazy<Field<any, any, any>> but it seems the compiler
      // would infer the third type param for Field to be any
      [key: string]: any
    } & {
      id?: never
      workspace?: never
      root?: never
      type?: never
    }
  >

  type InferRawFields<S> =
    // There's no fields in this type
    [S] extends [never]
      ? {}
      : // React element, like <p>Some jsx</p>
      S extends Presentational
      ? {}
      : // A section of fields or tabs
      S extends Section<infer U, any>
      ? U
      : // Lazy section
      S extends Lazy<infer U>
      ? U extends {[key: string]: any}
        ? {
            [K in keyof U]: U[K] extends Lazy<Field<infer T, infer M, infer Q>>
              ? T
              : {}
          }
        : {}
      : {}

  type InferTransformedFields<S> = [S] extends [never]
    ? {}
    : S extends Presentational
    ? {}
    : S extends Section<any, infer U>
    ? U
    : S extends Lazy<infer U>
    ? U extends {[key: string]: any}
      ? {
          [K in keyof U]: U[K] extends Lazy<Field<infer T, infer M, infer Q>>
            ? Q
            : {}
        }
      : {}
    : {}

  export type Input<T = any> = Section<T> | Presentational | Fields

  export type RawFieldsOf<T> = UnionToIntersection<InferRawFields<T>>
  export type TransformedFieldsOf<T> = UnionToIntersection<
    InferTransformedFields<T>
  >

  export function from<T>(input: Input<T>): Section<T> {
    if (input instanceof Section) return input
    if (isValidElement(input)) return new Section(undefined, () => input)
    return new Section(input, undefined)
  }

  export function withView<
    T extends Section,
    // We're not expecting a T return because we'd like factories to use
    // Section types so the underlying fields can be inferred. This reduces
    // type safety a little and should probably be revised later.
    Factory extends (...args: Array<any>) => Section
  >(create: Factory, view: ComponentType<{state: InputState; section: T}>) {
    return ((...args: Parameters<Factory>) => {
      const section = create(...args)
      section.view = ({state}) =>
        createElement(view, {state, section: section as T})
      return section
    }) as Factory
  }
}
*/
