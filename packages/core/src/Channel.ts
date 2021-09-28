import {Field} from './Field'
import {Label} from './Label'
import {Lazy} from './util/Lazy'
import {LazyRecord} from './util/LazyRecord'

export interface Channel<T = {}> {
  label: Label
  fields: LazyRecord<Field>
  options?: {
    isContainer?: boolean
    contains?: Array<string>
  }
}

export namespace Channel {
  export type TypeOf<T> = T extends Channel<infer U> ? U : never

  export function concat(a: Channel, b: Channel) {
    const aFields = Channel.fields(a)
    const bFields = Channel.fields(b)
    return {
      label: `${Lazy.get(a.label)}+${Lazy.get(b.label)}`,
      fields: Object.fromEntries(aFields.concat(bFields)),
      options: {...a.options, ...b.options}
    }
  }

  export function fields(channel: Channel) {
    return LazyRecord.iterate(channel.fields)
  }

  export function field(channel: Channel, key: string) {
    const field = LazyRecord.get(channel.fields, key)
    if (!field)
      throw new Error(
        `No such field: "${key}" in channel "${Lazy.get(channel.label)}"`
      )
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
  options?: Channel['options']
): Channel<RowOf<Fields>> {
  return {label, fields, options}
}
