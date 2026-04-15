import type {FieldOptions, WithoutLabel} from '#/core.js'
import {ScalarField} from '#/core/field/ScalarField.js'
import {viewKeys} from '#/core/ViewKeys.js'
import type {ReactNode} from 'react'

export interface NumberOptions extends FieldOptions<number | null> {
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: ReactNode
  /** Display a minimal version */
  inline?: boolean
  /** A minimum value */
  minValue?: number
  /** A maximum value */
  maxValue?: number
  /** Specifies the legal number intervals */
  step?: number
}

export class NumberField extends ScalarField<number | null, NumberOptions> {}

export function number(
  label: string,
  options: WithoutLabel<NumberOptions> = {}
): NumberField {
  return new NumberField({
    options: {label, ...options},
    view: viewKeys.NumberInput
  })
}
