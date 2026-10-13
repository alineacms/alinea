import {expect, expectTypeOf, test} from 'bun:test'
import {Field} from '#/index.js'
import type {EntryOptions, QuerySettings} from '#/types.js'

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
