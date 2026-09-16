import {expect, test} from 'bun:test'
import {fieldWidth} from './EntryFields.js'

test('field widths retain their configured percentages', () => {
  expect(fieldWidth(0.2)).toBe('calc(20% - var(--alinea-field-gap) * 0.8)')
  expect(fieldWidth(0.6)).toBe('calc(60% - var(--alinea-field-gap) * 0.4)')
  expect(fieldWidth()).toBe('100%')
})

test('field widths stay within the supported range', () => {
  expect(fieldWidth(-1)).toBe('0px')
  expect(fieldWidth(2)).toBe('100%')
})
