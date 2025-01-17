import {Field} from 'alinea'

export type PositionField = Field.Create<{
  x: number | null
  y: number | null
}>

export function position(
  label: string,
  options: Field.Options<PositionField> = {}
): PositionField {
  return Field.create({
    label,
    options,
    view: '@/field/PositionField.view#PositionInput'
  })
}
