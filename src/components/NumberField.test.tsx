import {cleanup, render, screen} from '#test/react.js'
import {afterEach, expect, test} from 'bun:test'
import {NumberField} from './NumberField.js'

afterEach(cleanup)

test('NumberField does not group digits unless asked', () => {
  const view = render(<NumberField label="Year" value={2023} />)
  const input = screen.getByRole('textbox') as HTMLInputElement
  expect(input.value).toBe('2023')
  view.rerender(
    <NumberField
      label="Year"
      value={2023}
      formatOptions={{useGrouping: true}}
    />
  )
  expect(input.value).toBe('2,023')
})
