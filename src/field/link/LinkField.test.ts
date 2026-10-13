import {Field} from '#/core/Field.js'
import type {LinkResolver} from '#/core/db/LinkResolver.js'
import {expect, expectTypeOf, test} from 'bun:test'
import {entry} from './EntryLink.js'
import type {InferQueryValue} from '#/core/Infer.js'
import {text} from '#/field/text.js'
import {image, type ImageLink} from './ImageLink.js'
import {link, type Link} from './Link.js'

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

test('external links take the title of the link picker as their label', async () => {
  const [titled, labeled] = await Field.queryValue(
    link.multiple('Links'),
    [
      {
        _id: 'titled',
        _type: 'url',
        _index: 'a0',
        _url: 'https://example.com',
        _title: 'Example',
        _target: '_blank'
      },
      {
        _id: 'labeled',
        _type: 'url',
        _index: 'a1',
        _url: 'https://example.com',
        _title: 'Example',
        _target: '_blank',
        _label: 'Custom'
      }
    ],
    {} as LinkResolver
  )
  expect(titled._label).toBe('Example')
  expect(labeled._label).toBe('Custom')
  const [cleared] = await Field.queryValue(
    link.multiple('Links'),
    [
      {
        _id: 'cleared',
        _type: 'url',
        _index: 'a0',
        _url: 'https://example.com',
        _title: 'Example',
        _target: '_blank',
        _label: ''
      }
    ],
    {} as LinkResolver
  )
  expect(cleared._label).toBe('')
})

test('link types default to links without fields', () => {
  const plain = link.multiple('Buttons')
  const withFields = link.multiple('Buttons', {
    fields: {variant: text('Variant')}
  })
  expectTypeOf<InferQueryValue<typeof plain>>().toMatchTypeOf<Array<Link>>()
  expectTypeOf<InferQueryValue<typeof withFields>>().toMatchTypeOf<
    Array<Link>
  >()
  const cover = image('Cover')
  const captioned = image('Cover', {fields: {caption: text('Caption')}})
  // Queried images fit a plain ImageLink, with or without extra fields
  const images: Array<ImageLink> = [
    {} as InferQueryValue<typeof cover>,
    {} as InferQueryValue<typeof captioned>
  ]
  expect(images).toHaveLength(2)
})
