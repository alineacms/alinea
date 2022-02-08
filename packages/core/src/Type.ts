import type {ComponentType} from 'react'
import {Entry} from './Entry'
import {createError} from './ErrorWithCode'
import {Field} from './Field'
import {createId} from './Id'
import {Label} from './Label'
import {Lazy} from './util/Lazy'
import {LazyRecord} from './util/LazyRecord'
import {Value} from './Value'
import {RecordValue} from './value/RecordValue'

export namespace Type {
  export type Of<T> = T extends Type<infer U> ? U : never
  export type Options = {
    /** Entries can be created as children of this entry */
    isContainer?: boolean
    /** Entries do not show up in the sidebar content tree */
    isHidden?: boolean
    contains?: Array<string>
    icon?: ComponentType
    view?: ComponentType
  }
}

const reserved = new Set(['id', 'type'])

export class Type<T = {}> {
  constructor(
    public label: Label,
    public fields: Record<string, Field>,
    public options: Type.Options = {}
  ) {
    for (const key of Object.keys(fields)) {
      if (reserved.has(key))
        throw createError(
          `Field name "${key}" is reserved, in channel "${label}"`
        )
    }
  }

  get valueType() {
    return Value.Record(
      Object.fromEntries(
        [
          ['id', Value.Scalar as Value],
          ['type', Value.Scalar as Value],
          ['workspace', Value.Scalar as Value],
          ['root', Value.Scalar as Value],
          // Todo: this should probably not be part of the schema but local state
          ['$status', Value.Scalar as Value]
        ].concat(
          Array.from(this).map(([key, field]) => {
            return [key, field.type]
          })
        )
      )
    ) as RecordValue<T>
  }

  [Symbol.iterator]() {
    return Object.entries(this.fields)[Symbol.iterator]()
  }

  field(key: string) {
    const field = this.fields[key]
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
}

type RowOf<LazyFields> = LazyFields extends Lazy<infer U>
  ? U extends {[key: string]: any}
    ? {
        [K in keyof U]: U[K] extends Field<infer T> ? T : any
      }
    : never
  : never

export function type<Fields extends LazyRecord<Field>>(
  label: Label,
  fields: Fields & {id?: never; type?: never},
  options?: Type.Options
): Type<RowOf<Fields>> {
  return new Type(label, LazyRecord.resolve(fields), options)
}
