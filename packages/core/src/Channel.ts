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

export function channel<T>(
  label: Label,
  fields: Lazy<{[key: string]: Lazy<Field>}>,
  options?: Channel['options']
): Channel<T> {
  return {label, fields, options}
}
