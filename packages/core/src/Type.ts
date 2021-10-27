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

export class Type<T = {}> {
  #fields: LazyRecord<Field>

  constructor(
    public label: Label,
    fields: LazyRecord<Field>,
    public options: Type.Options = {}
  ) {
    this.#fields = fields
  }

  get valueType(): RecordValue {
    return Value.Record(
      Object.fromEntries(
        Array.from(this).map(([key, field]) => {
          return [key, field.type]
        })
      )
    )
  }

  [Symbol.iterator]() {
    return LazyRecord.iterate(this.#fields)[Symbol.iterator]()
  }

  get fields() {
    return LazyRecord.resolve(this.#fields)
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
  fields: Fields,
  options?: Type.Options
): Type<RowOf<Fields>> {
  return new Type(label, fields, options)
}
