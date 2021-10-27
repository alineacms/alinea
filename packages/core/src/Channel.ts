import {Value} from '.'
import {Field} from './Field'
import {Label} from './Label'
import {RecordValue} from './type/RecordValue'
import {Lazy} from './util/Lazy'
import {LazyRecord} from './util/LazyRecord'

export namespace Channel {
  export type TypeOf<T> = T extends Channel<infer U> ? U : never
  export type Options = {
    isContainer?: boolean
    contains?: Array<string>
  }
}

export class Channel<T = {}> {
  #fields: LazyRecord<Field>

  constructor(
    public label: Label,
    fields: LazyRecord<Field>,
    public options: Channel.Options = {}
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
      throw new Error(`No such field: "${key}" in channel "${this.label}"`)
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

export function channel<Fields extends LazyRecord<Field>>(
  label: Label,
  fields: Fields,
  options?: Channel.Options
): Channel<RowOf<Fields>> {
  return new Channel(label, fields, options)
}
