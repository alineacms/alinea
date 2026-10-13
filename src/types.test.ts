import {expect, expectTypeOf, test} from 'bun:test'
import {Field} from '#/index.js'
import type {
  EntriesOptions,
  EntryOptions,
  QuerySettings,
  WithoutLabel
} from '#/types.js'

test('alinea/types exports the entry link options and query settings', () => {
  function pageLink(
    label: string,
    options: Omit<EntryOptions<undefined>, 'label'> = {}
  ) {
    return Field.entry(label, {...options, required: true})
  }
  expect(pageLink('Page', {help: 'Pick a page'})).toBeDefined()
  expectTypeOf<QuerySettings['first']>().toEqualTypeOf<true | undefined>()
})

test('link options type wrappers that set their own fields', () => {
  const fields = {label: Field.text('Label')}
  function pageLinks(
    label: string,
    options: Omit<WithoutLabel<EntriesOptions<typeof fields>>, 'fields'> = {}
  ) {
    return Field.entry.multiple(label, {...options, fields})
  }
  expect(pageLinks('Pages', {max: 3, initialValue: []})).toBeDefined()
})
