import {Collection, Expr} from '@alineacms/store'
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
  export type Of<T> = T extends Type<infer U> ? U : never
  export type Options<T> = {
    /** Entries can be created as children of this entry */
    isContainer?: boolean
    /** Entries do not show up in the sidebar content tree */
    isHidden?: boolean
    /** Accepts entries of these types as children */
    contains?: Array<string>
    icon?: ComponentType

    // Todo: there's a bunch of views here how should be approach naming?
    // Todo: add a pageView
    view?: ComponentType
    summaryRow?: View<any> // View<T>
    summaryThumb?: View<any> // View<T>

    /** Create indexes on fields of this type */
    index?: (fields: Collection<T>) => Record<string, Array<Expr<any>>>
  }
}

const reserved = new Set(['id', 'type'])

export class Type<T = any> {
  private __fields: Record<string, Lazy<Field<any, any>>> | undefined

  constructor(
    public label: Label,
    public sections: Array<Section>,
    public options: Type.Options<T> = {}
  ) {}

  get fields() {
    if (this.__fields) return this.__fields
    const res = {}
    for (const section of this.sections)
      if (section.fields) Object.assign(res, Lazy.get(section.fields))
    return (this.__fields = res)
  }

  get valueType(): RecordValue {
    return Value.Record(
      Object.fromEntries(
        [
          ['id', Value.Scalar as Value],
          ['type', Value.Scalar as Value],
          // Todo: builtins should passed in because we re-use type for non entry things too
          ['workspace', Value.Scalar as Value],
          ['root', Value.Scalar as Value],
          // Todo: this should probably not be part of the schema but local state
          ['$status', Value.Scalar as Value]
        ].concat(
          Array.from(this)
            .filter(([, field]) => field.type)
            .map(([key, field]) => {
              return [key, field.type!]
            })
        )
      )
    )
  }

  [Symbol.iterator]() {
    return LazyRecord.iterate(this.fields)[Symbol.iterator]()
  }

  field(key: string) {
    const field = LazyRecord.get(this.fields, key)
    if (!field)
      throw new Error(`No such field: "${key}" in type "${this.label}"`)
    return field
  }

  empty() {
    return this.valueType.create()
  }

  create(name: string) {
    return {
      ...this.empty(),
      type: name,
      id: createId()
    } as Entry & T
  }

  configure(options: Type.Options<T>): Type<T> {
    return new Type(this.label, this.sections, {
      ...this.options,
      ...options
    })
  }
}

export function type<T extends Array<Section.Input>>(
  label: Label,
  ...sections: T
): Type<Section.FieldsOf<T[number]>> {
  return new Type(label, sections.map(Section.from))
}
