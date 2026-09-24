import {Field} from '#/core/Field.js'
import type {LinkResolver} from '#/core/db/LinkResolver.js'
import {expect, expectTypeOf, test} from 'bun:test'
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

test('custom link labels stay on the queried link', async () => {
  const loader = {
    async resolveLinks() {
      return [{title: 'Target', url: '/target'}]
    }
  } as unknown as LinkResolver
  const single = await Field.queryValue(
    link('Link'),
    {
      _id: 'link',
      _type: 'entry',
      _index: '',
      _entry: 'target',
      _label: 'Custom'
    },
    loader
  )
  const [url, page] = await Field.queryValue(
    link.multiple('Links'),
    [
      {
        _id: 'url',
        _type: 'url',
        _index: 'a0',
        _url: 'https://example.com',
        _title: 'Example',
        _target: '_blank',
        _label: 'External'
      },
      {_id: 'page', _type: 'entry', _index: 'a1', _entry: 'target'}
    ],
    loader
  )
  const entryLink = await Field.queryValue(
    entry('Entry'),
    {_id: 'entry', _type: 'entry', _entry: 'target', _label: 'Entry'},
    loader
  )

  expectTypeOf(single._label).toEqualTypeOf<string | undefined>()
  expectTypeOf(url._label).toEqualTypeOf<string | undefined>()
  expectTypeOf(entryLink._label).toEqualTypeOf<string | undefined>()
  expect(single).toMatchObject({_label: 'Custom', fields: {}, url: '/target'})
  expect(url).toMatchObject({_label: 'External', fields: {}})
  expect(entryLink).toMatchObject({_label: 'Entry', fields: {}})
  expect(page).not.toHaveProperty('_label')
  for (const value of [single, url, page, entryLink])
    expect(value.fields).toEqual({})
})
