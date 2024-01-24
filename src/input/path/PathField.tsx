import {FieldOptions, WithoutLabel} from 'alinea/core/Field'
import {Hint} from 'alinea/core/Hint'
import {ScalarField} from 'alinea/core/field/ScalarField'

export interface PathOptions extends FieldOptions<string> {
  width?: number
  from?: string
  help?: string
  inline?: boolean
}

export class PathField extends ScalarField<string, PathOptions> {}

export function path(
  label: string,
  options: WithoutLabel<PathOptions> = {}
): PathField {
  if (options.shared)
    throw new Error(`The shared option is not supported on Path fields`)
  return new PathField({
    hint: Hint.String(),
    options: {label, ...options}
  })
}
