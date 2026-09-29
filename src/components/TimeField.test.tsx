import {cleanup, render, screen} from '#test/react.js'
import {afterEach, expect, test} from 'bun:test'
import {TimeField} from './TimeField.js'

afterEach(cleanup)

test('marks the time input invalid when validation fails', () => {
  const {container} = render(
    <TimeField
      aria-label="Start time"
      error="Field is required"
      required
      value={null}
    />
  )

  expect(container.querySelector('[aria-invalid="true"]')).toBeTruthy()
  expect(screen.getByText('Field is required')).toBeTruthy()
})

test('shows the ISO time value', () => {
  const {container} = render(
    <TimeField aria-label="Start time" hourCycle={24} value="14:30" />
  )
  expect(
    Array.from(container.querySelectorAll('[role="spinbutton"]')).map(
      element => element.textContent
    )
  ).toEqual(['14', '30'])
})
