import {Collection, Expr} from '@alinea/store'
import type {ComponentType} from 'react'
import {Entry} from './Entry'
import {Field} from './Field'
import {createId} from './Id'
import {Label} from './Label'
import {Section} from './Section'
import {Lazy} from './util/Lazy'
import {LazyRecord} from './util/LazyRecord'
import {Value} from './Value'
import {RecordValue} from './value/RecordValue'
import type {View} from './View'

export namespace Type {
  /** Infer the field types */
  export type Of<T> = T extends Type<infer U> ? U : never

  /** Optional settings to configure a Type */
  export type Options<T> = {
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
}

const reserved = new Set(['id', 'type'])

/** Describes the structure of an entry by their fields and type */
export class Type<T = any> {
  private __fields: Record<string, Lazy<Field<any, any>>> | undefined

  constructor(
    public label: Label,
    public sections: Array<Section>,
    public options: Type.Options<T> = {}
  ) {}

  get isContainer() {
    return Boolean(this.options.isContainer)
  }

  get fields() {
    if (this.__fields) return this.__fields
    const res = {}
    for (const section of this.sections)
      if (section.fields) Object.assign(res, Lazy.get(section.fields))
    return (this.__fields = res)
  }

  get valueType(): RecordValue<T> {
    return Value.Record(
      Object.fromEntries(
        Array.from(this)
          .filter(([, field]) => field.type)
          .map(([key, field]) => {
            return [key, field.type!]
          })
      )
    )
  }

  [Symbol.iterator]() {
    return LazyRecord.iterate(this.fields)[Symbol.iterator]()
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
    return this.valueType.create()
  }

  /** Create a new Entry instance this type */
  create(name: string) {
    return {
      ...this.empty(),
      type: name,
      id: createId()
    } as Entry & T
  }

  /** Configure this type, returns a new instance */
  configure(options: Type.Options<T>): Type<T> {
    return new Type(this.label, this.sections, {
      ...this.options,
      ...options
    })
  }
}

/** Create a new type */
export function type<T extends Array<Section.Input>>(
  label: Label,
  ...sections: T
): Type<Section.FieldsOf<T[number]>> {
  return new Type(label, sections.map(Section.from))
}
