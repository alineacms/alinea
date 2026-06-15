import {cleanup, render, screen} from '#test/react.js'
import {Field} from '#/core/Field.js'
import {type} from '#/core/Type.js'
import {viewKeys} from '#/dashboard/ViewKeys.js'
import {DashboardScopeInternal} from '#/dashboard/hooks.js'
import {Dashboard} from '#/dashboard/store.js'
import {json} from '#/field/json.js'
import {list} from '#/field/list.js'
import {object} from '#/field/object.js'
import {richText} from '#/field/richtext.js'
import {select} from '#/field/select.js'
import {text} from '#/field/text.js'
import {atom, type Atom} from 'jotai'
import type {ComponentType} from 'react'
import {afterEach, expect, test} from 'bun:test'
import {
  CompactField,
  CompactRecordFields,
  compactFieldText
} from './CompactField.js'

interface TestDashboard {
  view(key: string): Atom<ComponentType | undefined>
}

const dashboard = {
  view() {
    return atom(() => undefined)
  }
} satisfies TestDashboard as unknown as Dashboard

afterEach(cleanup)

test('CompactField renders select option labels', () => {
  const field = select('Status', {
    options: {draft: 'Draft', review: 'In review'}
  })
  render(
    <DashboardScopeInternal dashboard={dashboard}>
      <CompactField field={field} value="review" />
    </DashboardScopeInternal>
  )

  expect(screen.getByText('In review')).toBeDefined()
  expect(compactFieldText(field, 'review')).toBe('In review')
})

test('CompactField renders empty values consistently', () => {
  const field = json('Payload')
  render(
    <DashboardScopeInternal dashboard={dashboard}>
      <CompactField field={field} value={null} />
    </DashboardScopeInternal>
  )

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
    <DashboardScopeInternal dashboard={dashboard}>
      <CompactField
        field={field}
        value={{title: 'Explorer table', summary: 'Compact values'}}
      />
    </DashboardScopeInternal>
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
    <DashboardScopeInternal dashboard={dashboard}>
      <CompactRecordFields
        fields={fields}
        layout="footer"
        value={{title: 'Explorer table', priority: 'High'}}
      />
    </DashboardScopeInternal>
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
  render(
    <DashboardScopeInternal dashboard={dashboard}>
      <CompactField field={field} value={value} />
    </DashboardScopeInternal>
  )

  expect(screen.getByText('2 items')).toBeDefined()
  expect(screen.queryByText('One')).toBeNull()
  expect(compactFieldText(field, value)).toBe('2 items')
})

test('CompactField renders multiple select option labels', () => {
  const field = select.multiple('Channels', {
    options: {web: 'Web', app: 'App', email: 'Email'}
  })
  render(
    <DashboardScopeInternal dashboard={dashboard}>
      <CompactField field={field} value={['web', 'email']} />
    </DashboardScopeInternal>
  )

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
  render(
    <DashboardScopeInternal dashboard={dashboard}>
      <CompactField field={field} value={value} />
    </DashboardScopeInternal>
  )

  expect(Field.compactView(field)).toBe(viewKeys.RichTextCompact)
  expect(screen.getByText('Plain rich text preview')).toBeDefined()
  expect(compactFieldText(field, value)).toBe('Plain rich text preview')
})
