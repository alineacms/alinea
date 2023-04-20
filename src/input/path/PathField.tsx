import {Field, FieldOptions, Hint, Label} from 'alinea/core'

export interface PathOptions extends FieldOptions {
  width?: number
  from?: string
  help?: Label
  inline?: boolean
  optional?: boolean
}

export class PathField extends Field.Scalar<string, PathOptions> {}

export function path(label: Label, options: PathOptions = {}): PathField {
  return new PathField({
    hint: Hint.String(),
    label,
    options
  })
}
