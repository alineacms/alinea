import {Field, Label, Reference, Type, Value} from '@alinea/core'
import {RecordValue} from '@alinea/core/value/RecordValue'

export type LinkType = 'entry' | 'image' | 'file' | 'external'

export type LinkOptions<T> = {
  fields?: Type<T>
  width?: number
  optional?: boolean
  help?: Label
  inline?: boolean
  type?: LinkType | Array<LinkType>
  max?: number
}

export interface LinkField<T> extends Field.List<Reference & T> {
  label: Label
  options: LinkOptions<T>
}

export function createLink<T = {}>(
  label: Label,
  options: LinkOptions<T> = {}
): LinkField<T> {
  const extra = options.fields?.valueType
  return {
    type: Value.List({
      entry: new RecordValue({
        entry: Value.Scalar
      }).concat(extra),
      url: new RecordValue({
        url: Value.Scalar
      }).concat(extra)
    }),
    label,
    options
  }
}
