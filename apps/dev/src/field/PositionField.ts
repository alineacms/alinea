import {FieldOptions, ScalarField, WithoutLabel} from 'alinea/core'

export interface PositionOptions extends FieldOptions<Position> {}

export interface Position {
  x: number | null
  y: number | null
}

class PositionField extends ScalarField<Position, PositionOptions> {}

export function position(
  label: string,
  options: WithoutLabel<PositionOptions> = {}
) {
  return new PositionField({
    options: {label, ...options},
    view: '@/field/PositionField.view#PositionInput'
  })
}
