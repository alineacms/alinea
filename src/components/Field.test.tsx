import {cleanup, render, screen} from '#test/react.js'
import {afterEach, expect, test} from 'bun:test'
import {Field} from './Field.js'

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
