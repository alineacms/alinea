import {cleanup, render, screen} from '#test/react.js'
import {Field} from '#/core/Field.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import {type} from '#/core/Type.js'
import {viewKeys} from '#/dashboard/ViewKeys.js'
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

test('CompactField renders select option labels', () => {
  const field = select('Status', {
    options: {draft: 'Draft', review: 'In review'}
  })
  render(<CompactField field={field} value="review" />)

  expect(screen.getByText('In review')).toBeDefined()
  expect(compactFieldText(field, 'review')).toBe('In review')
})

test('CompactField renders empty values consistently', () => {
  const field = json('Payload')
  render(<CompactField field={field} value={null} />)

  expect(screen.getByText('-')).toBeDefined()
  expect(compactFieldText(field, null)).toBe('-')
})

test('CompactField renders object field summaries', () => {
  const field = object('Feature', {
    fields: {
      title: text('Title'),
      summary: text('Summary')
    }
  })
  render(
    <CompactField
      field={field}
      value={{title: 'Explorer table', summary: 'Compact values'}}
    />
  )

  expect(screen.getByText('Title')).toBeDefined()
  expect(screen.getByText('Explorer table')).toBeDefined()
  expect(compactFieldText(field, {title: 'Explorer table'})).toContain(
    'Title Explorer table'
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

  expect(screen.getByText('Title')).toBeDefined()
  expect(screen.getByText('Summary')).toBeDefined()
  expect(screen.getByText('Priority')).toBeDefined()
  expect(screen.getByText('Status')).toBeDefined()
  expect(screen.getByText('Explorer table')).toBeDefined()
  expect(screen.getByText('High')).toBeDefined()
  expect(screen.getAllByText('-')).toHaveLength(2)
})

test('CompactField renders list fields as a count', () => {
  const item = type('Item', {
    fields: {
      title: text('Title')
    }
  })
  const field = list('Items', {
    schema: {item}
  })
  const value = [
    {_id: '1', _index: 'a0', _type: 'item', title: 'One'},
    {_id: '2', _index: 'a1', _type: 'item', title: 'Two'}
  ]
  render(<CompactField field={field} value={value} />)

  expect(screen.getByText('2 items')).toBeDefined()
  expect(screen.queryByText('One')).toBeNull()
  expect(compactFieldText(field, value)).toBe('2 items')
})

test('CompactField renders multiple select option labels', () => {
  const field = select.multiple('Channels', {
    options: {web: 'Web', app: 'App', email: 'Email'}
  })
  render(<CompactField field={field} value={['web', 'email']} />)

  expect(screen.getByText('Web')).toBeDefined()
  expect(screen.getByText('Email')).toBeDefined()
  expect(compactFieldText(field, ['web', 'email'])).toBe('Web, Email')
})

test('CompactField renders rich text arrays as text', () => {
  const field = richText('Body')
  const value = [
    {
      type: 'paragraph',
      content: [{type: 'text', text: 'Plain rich text preview'}]
    }
  ]
  render(<CompactField field={field} value={value} />)

  expect(Field.compactView(field)).toBe(viewKeys.RichTextCompact)
  expect(screen.getByText('Plain rich text preview')).toBeDefined()
  expect(compactFieldText(field, value)).toBe('Plain rich text preview')
})

test('CompactField shows the locale value of localised fields', () => {
  const localise = localiser({
    locales: ['en', 'nl'],
    fallback: () => ['en']
  })
  const field = localise(text('Badge'))
  const value = {en: 'Bestseller', nl: ''}
  render(<CompactField field={field} value={value} locale="en" />)

  expect(screen.getByText('Bestseller')).toBeDefined()
  expect(compactFieldText(field, value, {locale: 'en'})).toBe('Bestseller')
  // Falls back when the locale has no value
  expect(compactFieldText(field, value, {locale: 'nl'})).toBe('Bestseller')
  expect(compactFieldText(field, {en: '', nl: ''}, {locale: 'nl'})).toBe('-')
  expect(compactFieldText(field, value)).not.toContain('{')
})

test('CompactField shows the titles and previews of linked entries', () => {
  const field = image.multiple('Gallery')
  const value = [
    {_id: '1', _index: 'a0', _type: 'image', _entry: 'photo'},
    {_id: '2', _index: 'a1', _type: 'image', _entry: 'missing'}
  ]
  const links = new Map([
    ['photo', {title: 'Cane chair', preview: 'data:image/webp;base64,x'}]
  ])
  const view = render(
    <CompactField field={field} value={value} links={links} />
  )

  expect(screen.getByText('Cane chair')).toBeDefined()
  expect(screen.getByText('Image')).toBeDefined()
  expect(view.container.querySelector('img')?.getAttribute('src')).toBe(
    'data:image/webp;base64,x'
  )
  expect(compactFieldText(field, value, {links})).toBe('Cane chair, Image')
  const single = entry('Author')
  expect(
    compactFieldText(
      single,
      {_id: '1', _type: 'entry', _entry: 'photo'},
      {links}
    )
  ).toBe('Cane chair')
})

test('CompactField formats dates and numbers', () => {
  expect(compactFieldText(date('Published'), '2026-08-27')).toBe(
    new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeZone: 'UTC'
    }).format(new Date('2026-08-27T00:00:00Z'))
  )
  expect(compactFieldText(number('Year'), 2026)).toBe('2026')
  expect(compactFieldText(number('Size'), 345466)).toBe(
    (345466).toLocaleString(undefined)
  )
})

test('CompactField shows numbers without a unit, media sizes are columns', () => {
  expect(compactFieldText(MediaFile.size, 345466)).toBe(
    compactFieldText(number('Other'), 345466)
  )
  expect(compactFieldText(MediaFile.size, 345466)).not.toContain('kB')
})
