import {cleanup, render, screen} from '#test/react.js'
import {afterEach, expect, test} from 'bun:test'
import {TimeField} from './TimeField.js'

afterEach(cleanup)

test('marks the time input invalid when validation fails', () => {
  const {container} = render(
    <TimeField
      aria-label="Start time"
      errorMessage="Field is required"
      isInvalid
      isRequired
      value={null}
    />
  )

  expect(container.querySelector('[data-invalid="true"]')).toBeTruthy()
  expect(screen.getByText('Field is required')).toBeTruthy()
})
