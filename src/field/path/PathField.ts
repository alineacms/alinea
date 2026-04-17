import type {FieldOptions, WithoutLabel} from '#/core/Field.js'
import {ScalarField} from '#/core/field/ScalarField.js'
import {viewKeys} from '#/v2/ViewKeys.js'
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
