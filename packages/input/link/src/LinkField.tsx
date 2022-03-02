import {Field, Label, Reference, Value} from '@alinea/core'
import {RecordValue} from '@alinea/core/value/RecordValue'

export type LinkOptions = {
  width?: number
  optional?: boolean
  help?: Label
  inline?: boolean
  initialValue?: number
}

export interface LinkField extends Field<Array<Reference>> {
  label: Label
  options: LinkOptions
}

export function createLink(label: Label, options: LinkOptions = {}): LinkField {
  return {
    type: Value.List({
      entry: new RecordValue({
        entry: Value.Scalar
      }),
      url: new RecordValue({
        url: Value.Scalar
      })
    }),
    label,
    options
  }
}
