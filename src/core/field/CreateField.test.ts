import {expect, expectTypeOf, test} from 'bun:test'
import {Field} from '#/index.js'
import {Field as CoreField} from '../Field.js'
import type {FieldOptions, WithoutLabel} from '../Field.js'

interface RatingOptions extends FieldOptions<number> {
  max?: number
}

type RatingField = Field.Create<number, RatingOptions>

function rating(
  label: string,
  options: WithoutLabel<RatingOptions> = {}
): RatingField {
  return Field.create({label, options, view: () => null})
}

test('create accepts options that extend FieldOptions', () => {
  const field = rating('Rating', {max: 5, width: 0.5})
  expect(CoreField.options(field).max).toBe(5)
  expect(CoreField.options(field).width).toBe(0.5)
  expectTypeOf(CoreField.options(field).width).toEqualTypeOf<
    number | undefined
  >()
})

type RangeField = Field.Create<number, {min?: number}>

test('every field accepts a width', () => {
  expectTypeOf<Field.Options<RangeField>['width']>().toEqualTypeOf<
    number | undefined
  >()
  const options: Field.Options<RangeField> = {min: 0, width: 0.5}
  const field: RangeField = Field.create({
    label: 'Range',
    options,
    view: () => null
  })
  expect(CoreField.options(field).width).toBe(0.5)
})
