import {Field, Hint, Label, Shape} from 'alinea/core'

export type PathOptions = {
  width?: number
  from?: string
  help?: Label
  inline?: boolean
  optional?: boolean
  hidden?: boolean
}

export interface PathField extends Field.Scalar<string> {
  label: Label
  options: PathOptions
}

export function path(label: Label, options: PathOptions = {}): PathField {
  return {
    shape: Shape.Scalar(label),
    hint: Hint.String(),
    label,
    options,
    hidden: options.hidden
  }
}
