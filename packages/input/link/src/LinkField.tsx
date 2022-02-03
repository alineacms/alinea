import {Field, Label, Value} from '@alinea/core'

export type LinkOptions = {
  optional?: boolean
  help?: Label
  inline?: boolean
  initialValue?: number
}

export interface LinkField extends Field<string> {
  label: Label
  options: LinkOptions
}

export function createLink(label: Label, options: LinkOptions = {}): LinkField {
  return {
    type: Value.Scalar,
    label,
    options
  }
}
