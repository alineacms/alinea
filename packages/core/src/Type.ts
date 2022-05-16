import {Collection, Expr} from '@alinea/store'
import type {ComponentType} from 'react'
import {Entry} from './Entry'
import {Field} from './Field'
import {createId} from './Id'
import {Label} from './Label'
import type {Schema} from './Schema'
import {Section} from './Section'
import {Lazy} from './util/Lazy'
import {LazyRecord} from './util/LazyRecord'
import {Value} from './Value'
import {RecordValue} from './value/RecordValue'
import type {View} from './View'

export namespace Type {
  /** Infer the field types */
  export type Of<T> = T extends TypeConfig<infer U> ? U : never
}

/** Describes the structure of an entry by their fields and type */
export class Type<T = any> implements TypeConfig<T> {
  label: Label
  sections: Array<Section>
  options: TypeOptions<T>
  fields: Record<string, Field<any, any>> = {}
  shape: RecordValue<T>

  constructor(
    public schema: Schema,
    public name: string,
    public config: TypeConfig<T>
  ) {
    this.label = config.label
    this.options = config.options || {}
    this.sections = config.sections
    this.shape = Type.shape(config)
    for (const section of this.sections)
      if (section.fields) Object.assign(this.fields, Lazy.get(section.fields))
  }

  get isContainer() {
    return Boolean(this.options.isContainer)
  }

  static shape<T>(config: TypeConfig<T>): RecordValue<T> {
    return Value.Record(
      config.label,
      Object.fromEntries(
        config.sections
          .flatMap(section => LazyRecord.iterate(section.fields || {}))
          .filter(([, field]) => field.type)
          .map(([key, field]) => {
            return [key, field.type!]
          })
      )
    )
  }

  [Symbol.iterator]() {
    return Object.entries(this.fields)[Symbol.iterator]()
  }

  /** Get a field by name */
  field(key: string) {
    const field = LazyRecord.get(this.fields, key)
    if (!field)
      throw new Error(`No such field: "${key}" in type "${this.label}"`)
    return field
  }

  /** Create a new empty instance of this type's fields */
  empty() {
    return this.shape.create()
  }

  /** Create a new Entry instance of this type */
  create(name: string) {
    return {
      ...this.empty(),
      type: name,
      id: createId()
    } as Entry & T
  }

  /** Configure this type, returns a new instance */
  /*configure(options: Type.Options<T>): Type<T> {
    return new Type(this.label, this.sections, {
      ...this.options,
      ...options
    })
  }*/

  collection(): Collection<T> {
    const alias = this.name
    const fields = Entry.as(alias)
    return new Collection('Entry', {
      where: fields.type
        .is(alias)
        .and(fields.workspace.is(this.schema.workspace.name)),
      alias
    })
  }

  configure(options: TypeOptions<T>) {
    return type(this.label, ...this.sections).configure(options)
  }
}

/** Optional settings to configure a Type */
export type TypeOptions<T> = {
  /** Entries can be created as children of this entry */
  isContainer?: boolean
  /** Entries do not show up in the sidebar content tree */
  isHidden?: boolean
  /** Accepts entries of these types as children */
  contains?: Array<string>
  /** An icon (React component) to represent this type in the dashboard */
  icon?: ComponentType

  /** A React component used to view an entry of this type in the dashboard */
  view?: ComponentType
  /** A React component used to view a row of this type in the dashboard */
  summaryRow?: View<any>
  /** A React component used to view a thumbnail of this type in the dashboard */
  summaryThumb?: View<any>

  /** Create indexes on fields of this type */
  index?: (fields: Collection<T>) => Record<string, Array<Expr<any>>>
}

export type TypeConfig<T = any> = {
  label: Label
  sections: Array<Section>
  configure: (options: TypeOptions<T>) => TypeConfig<T>
  options: TypeOptions<T>
}

/** Create a new type */
export function type<T extends Array<Section.Input>>(
  label: Label,
  ...sections: T
): TypeConfig<Section.FieldsOf<T[number]>> {
  return {
    label,
    sections: sections.map(Section.from),
    options: {},
    configure(options) {
      return {...type(label, ...sections), options}
    }
  }
}
