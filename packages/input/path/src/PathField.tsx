import {Field, Label, Value} from '@alinea/core'

export type PathOptions = {
  width?: number
  from?: string
  help?: Label
  inline?: boolean
  optional?: boolean
}

export interface PathField extends Field.Scalar<string> {
  label: Label
  options: PathOptions
}

export function createPath(label: Label, options: PathOptions = {}): PathField {
  return {
    type: Value.Scalar(label),
    label,
    options
  }
}
