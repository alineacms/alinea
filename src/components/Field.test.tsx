import {cleanup, render, screen} from '#test/react.js'
import {afterEach, expect, test} from 'bun:test'
import {Field} from './Field.js'
import {FieldMissingIn} from './internal/FieldTranslation.js'

afterEach(cleanup)

test('Field renders shared field badge', () => {
  render(<Field label="Title" shared />)

  expect(screen.getByText('Title')).toBeTruthy()
  expect(screen.getByText('Shared')).toBeTruthy()
})

test('Field renders required marker and error', () => {
  render(
    <Field label="Title" required error="Title is required">
      <input />
    </Field>
  )

  expect(screen.getByText('*', {exact: false})).toBeTruthy()
  expect(screen.getByRole('alert').textContent).toBe('Title is required')
})

test('Field fades the header of a read-only field', () => {
  const {container} = render(<Field label="Title" readOnly />)
  const header = container.querySelector('[data-slot="field-header"]')

  expect(header?.className).toContain('is-disabled')
})

test('Field shows it is not translated when another language filled it in', () => {
  render(
    <FieldMissingIn.Provider value={['nl']}>
      <Field label="Title" />
    </FieldMissingIn.Provider>
  )
  const badge = screen.getByText('Not translated')
  expect(badge.closest('[title]')?.getAttribute('title')).toBe(
    'Filled in in NL'
  )
})

test('Field without a missing translation shows no badge', () => {
  render(<Field label="Title" />)
  expect(screen.queryByText('Not translated')).toBeNull()
})
