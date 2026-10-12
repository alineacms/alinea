import {cleanup, render, screen} from '#test/react.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import {type} from '#/core/Type.js'
import {date} from '#/field/date.js'
import {json} from '#/field/json.js'
import {entry, image} from '#/field/link.js'
import {localiser} from '#/field/localiser/Localiser.js'
import {number} from '#/field/number.js'
import {list} from '#/field/list.js'
import {object} from '#/field/object.js'
import {richText} from '#/field/richtext.js'
import {select} from '#/field/select.js'
import {text} from '#/field/text.js'
import {afterEach, expect, test} from 'bun:test'
import {
  CompactField,
  CompactRecordFields,
  compactFieldText
} from './CompactField.js'

afterEach(cleanup)

const gallery = image.multiple('Gallery')
const photos = [
  {_id: '1', _index: 'a0', _type: 'image', _entry: 'photo'},
  {_id: '2', _index: 'a1', _type: 'image', _entry: 'missing'}
]
const links = new Map([
  ['photo', {title: 'Cane chair', preview: 'data:image/webp;base64,x'}]
])

test('compact values summarize a field as text', () => {
  const badge = localiser({locales: ['en', 'nl'], fallback: () => ['en']})(
    text('Badge')
  )
  const item = type('Item', {fields: {title: text('Title')}})
  const size = (345466).toLocaleString(undefined)
  const cases: Array<[string, ...Parameters<typeof compactFieldText>]> = [
    [
      'In review',
      select('Status', {options: {draft: 'Draft', review: 'In review'}}),
      'review'
    ],
    [
      'Web, Email',
      select.multiple('Channels', {
        options: {web: 'Web', app: 'App', email: 'Email'}
      }),
      ['web', 'email']
    ],
    ['-', json('Payload'), null],
    [
      '2 items',
      list('Items', {schema: {item}}),
      [
        {_id: '1', _index: 'a0', _type: 'item', title: 'One'},
        {_id: '2', _index: 'a1', _type: 'item', title: 'Two'}
      ]
    ],
    [
      'Plain rich text preview',
      richText('Body'),
      [
        {
          type: 'paragraph',
          content: [{type: 'text', text: 'Plain rich text preview'}]
        }
      ]
    ],
    // Localised fields show their locale, falling back when it is empty
    ['Bestseller', badge, {en: 'Bestseller', nl: ''}, {locale: 'en'}],
    ['Bestseller', badge, {en: 'Bestseller', nl: ''}, {locale: 'nl'}],
    ['-', badge, {en: '', nl: ''}, {locale: 'nl'}],
    ['Cane chair, Image', gallery, photos, {links}],
    [
      'Cane chair',
      entry('Author'),
      {_id: '1', _type: 'entry', _entry: 'photo'},
      {links}
    ],
    [
      new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeZone: 'UTC'
      }).format(new Date('2026-08-27T00:00:00Z')),
      date('Published'),
      '2026-08-27'
    ],
    ['2026', number('Year'), 2026],
    [size, number('Size'), 345466],
    // Media sizes are formatted by their column, not as a field
    [size, MediaFile.size, 345466]
  ]
  for (const [expected, ...args] of cases)
    expect(compactFieldText(...args)).toBe(expected)
  const feature = object('Feature', {
    fields: {title: text('Title'), summary: text('Summary')}
  })
  expect(compactFieldText(feature, {title: 'Explorer table'})).toContain(
    'Title Explorer table'
  )
})

test('CompactField shows the titles and previews of linked entries', () => {
  const view = render(
    <CompactField field={gallery} value={photos} links={links} />
  )

  expect(screen.getByText('Cane chair')).toBeDefined()
  expect(screen.getByText('Image')).toBeDefined()
  expect(view.container.querySelector('img')?.getAttribute('src')).toBe(
    'data:image/webp;base64,x'
  )
})

test('CompactRecordFields footer renders all visible fields', () => {
  const fields = {
    title: text('Title'),
    summary: text('Summary'),
    priority: text('Priority'),
    status: text('Status')
  }
  render(
    <CompactRecordFields
      fields={fields}
      layout="footer"
      value={{title: 'Explorer table', priority: 'High'}}
    />
  )

  for (const label of ['Title', 'Summary', 'Priority', 'Status'])
    expect(screen.getByText(label)).toBeDefined()
  expect(screen.getByText('Explorer table')).toBeDefined()
  expect(screen.getByText('High')).toBeDefined()
  expect(screen.getAllByText('-')).toHaveLength(2)
})
