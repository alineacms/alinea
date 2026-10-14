import {Query} from '#/index.js'
import {expect, test} from 'bun:test'
import {entryPicker} from './EntryPicker.js'

test('entry pickers reject relation filters in a static condition', () => {
  expect(() =>
    entryPicker({
      selection: {},
      condition: {_referenced: Query.referencedBy({})}
    })
  ).toThrow(/Invalid entry picker condition: Relation filters/)
})

test('entry pickers accept plain conditions and dynamic ones', () => {
  expect(() =>
    entryPicker({selection: {}, condition: {_type: 'Page'}})
  ).not.toThrow()
  expect(() =>
    entryPicker({selection: {}, condition: () => ({_type: 'Page'})})
  ).not.toThrow()
})
