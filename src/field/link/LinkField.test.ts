import {Field} from '#/core/Field.js'
import type {LinkResolver} from '#/core/db/LinkResolver.js'
import {expect, expectTypeOf, test} from 'bun:test'
import {entry, type EntryLink} from './EntryLink.js'
import type {InferQueryValue} from '#/core/Infer.js'
import {text} from '#/field/text.js'
import {image, type ImageLink} from './ImageLink.js'
import {link, type Link, type LinkRow} from './Link.js'
import type {UrlLink} from './UrlLink.js'

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

  expectTypeOf(single.label).toEqualTypeOf<string | undefined>()
  expectTypeOf(url.label).toEqualTypeOf<string | undefined>()
  expectTypeOf(entryLink.label).toEqualTypeOf<string | undefined>()
  expect(single).toMatchObject({label: 'Custom', fields: {}, url: '/target'})
  expect(url).toMatchObject({label: 'External', fields: {}})
  expect(entryLink).toMatchObject({label: 'Entry', fields: {}})
  expect(page).not.toHaveProperty('label')
  // The stored _label stays on the queried link for existing queries
  expect(single).toMatchObject({_label: 'Custom'})
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
  expect(titled.label).toBe('Example')
  expect(labeled.label).toBe('Custom')
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
  expect(cleared.label).toBe('')
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

test('link fields can be limited to some kinds of links', () => {
  const pagesAndUrls = link('Link', {kinds: ['entry', 'url']})
  const urls = link.multiple('Links', {kinds: ['url'], max: 3})
  expect(Object.keys(Field.options(pagesAndUrls).pickers)).toEqual([
    'entry',
    'url'
  ])
  expect(Object.keys(Field.options(urls).pickers)).toEqual(['url'])
  expect(Object.keys(Field.options(link('Link')).pickers)).toEqual([
    'entry',
    'url',
    'file'
  ])
  expect(Field.options(urls).max).toBe(3)
  expect(Field.options(pagesAndUrls)).not.toHaveProperty('kinds')
  expectTypeOf<InferQueryValue<typeof pagesAndUrls>>().toEqualTypeOf<
    EntryLink | UrlLink
  >()
  expectTypeOf<InferQueryValue<typeof urls>>().toEqualTypeOf<Array<UrlLink>>()
  expectTypeOf<InferQueryValue<ReturnType<typeof link>>>().toEqualTypeOf<Link>()
  expect(() => link('Link', {kinds: []})).toThrow()
})

test('link fields take kinds from a shared constant', () => {
  const kinds = ['entry', 'url'] as const
  const field = link('Link', {kinds})
  expectTypeOf<InferQueryValue<typeof field>>().toEqualTypeOf<
    EntryLink | UrlLink
  >()
})

test('links of a kind a field no longer offers are left out', async () => {
  const loader = {
    async resolveLinks() {
      return [{title: 'Target', url: '/target'}]
    }
  } as unknown as LinkResolver
  // Stored while the field still offered files
  const fileLink = {
    _id: 'file',
    _type: 'file',
    _index: 'a0',
    _entry: 'doc'
  } as unknown as LinkRow
  const single = await Field.queryValue(
    link('Link', {kinds: ['entry', 'url']}),
    fileLink,
    loader
  )
  expect(single).toBeNull()
  const rows = await Field.queryValue(
    link.multiple('Links', {kinds: ['url']}),
    [
      fileLink,
      {
        _id: 'url',
        _type: 'url',
        _index: 'a1',
        _url: 'https://example.com',
        _title: '',
        _target: ''
      } as unknown as LinkRow
    ],
    loader
  )
  expect(rows.map(row => row._id)).toEqual(['url'])
})
