import type {FieldOptions, WithoutLabel} from 'alinea/core/Field'
import {ScalarField} from 'alinea/core/field/ScalarField'
import {viewKeys} from 'alinea/dashboard/editor/ViewKeys'
import type {ReactNode} from 'react'

export interface PathOptions extends FieldOptions<string> {
  width?: number
  from?: string
  help?: ReactNode
  inline?: boolean
}

export class PathField extends ScalarField<string, PathOptions> {}

export function path(
  label: string,
  options: WithoutLabel<PathOptions> = {}
): PathField {
  if (options.shared)
    throw new Error('The shared option is not supported on Path fields')
  return new PathField({
    options: {label, ...options},
    view: viewKeys.PathInput
  })
}
