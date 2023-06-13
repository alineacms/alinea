import {Field, FieldOptions} from 'alinea/core/Field'
import {Hint} from 'alinea/core/Hint'
import {Label} from 'alinea/core/Label'

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
