import {createError} from './ErrorWithCode'
import {Field} from './Field'
import {Label} from './Label'
import {RecordValue} from './type/RecordValue'
import {Lazy} from './util/Lazy'
import {LazyRecord} from './util/LazyRecord'
import {Value} from './Value'

export namespace Type {
  export type Of<T> = T extends Type<infer U> ? U : never
  export type Options = {
    isContainer?: boolean
    contains?: Array<string>
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

  get valueType(): RecordValue {
    return Value.Record(
      Object.fromEntries(
        [
          ['id', Value.Scalar as Value],
          ['type', Value.Scalar as Value]
        ].concat(
          Array.from(this).map(([key, field]) => {
            return [key, field.type]
          })
        )
      )
    )
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
