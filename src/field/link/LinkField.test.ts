import {Field} from '#/core/Field.js'
import {expect, test} from 'bun:test'
import {entry} from './EntryLink.js'
import {link} from './Link.js'

test('multiple link fields configure duplicate entries independently', () => {
  expect(Field.options(entry.multiple('Entries')).allowDuplicates).toBe(false)
  expect(Field.options(link.multiple('Links')).allowDuplicates).toBe(true)
  expect(
    Field.options(entry.multiple('Entries', {allowDuplicates: true}))
      .allowDuplicates
  ).toBe(true)
  expect(
    Field.options(link.multiple('Links', {allowDuplicates: false}))
      .allowDuplicates
  ).toBe(false)
})
